#![no_std]

use soroban_sdk::{
    contract, contracterror, contractevent, contractimpl, contracttype, token, Address, BytesN,
    Env, Vec,
};

#[contract]
pub struct PactsetEscrow;

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum MilestoneState {
    Pending,
    Submitted,
    CorrectionRequested,
    Disputed,
    Released,
    Refunded,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Milestone {
    pub amount: i128,
    pub state: MilestoneState,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct EscrowConfig {
    pub agreement_hash: BytesN<32>,
    pub agreement_version: u32,
    pub payer: Address,
    pub payee: Address,
    pub resolver: Address,
    pub asset: Address,
    pub terms_hash: BytesN<32>,
    pub total_amount: i128,
    pub funded: bool,
}

#[contracttype]
#[derive(Clone)]
enum DataKey {
    Config,
    Milestones,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum Resolution {
    ReleaseToPayee,
    RefundToPayer,
}

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum EscrowError {
    AlreadyInitialized = 1,
    InvalidMilestones = 2,
    InvalidAmount = 3,
    AlreadyFunded = 4,
    NotFunded = 5,
    InvalidMilestone = 6,
    InvalidState = 7,
    Unauthorized = 8,
    ArithmeticOverflow = 9,
}

#[contractevent]
pub struct EscrowFunded {
    #[topic]
    pub agreement_hash: BytesN<32>,
    pub amount: i128,
}

#[contractevent]
pub struct MilestoneChanged {
    #[topic]
    pub agreement_hash: BytesN<32>,
    #[topic]
    pub index: u32,
    pub amount: i128,
    pub state: MilestoneState,
}

fn config(env: &Env) -> EscrowConfig {
    env.storage().instance().get(&DataKey::Config).unwrap()
}

fn milestones(env: &Env) -> Vec<Milestone> {
    env.storage().instance().get(&DataKey::Milestones).unwrap()
}

fn milestone_at(items: &Vec<Milestone>, index: u32) -> Result<Milestone, EscrowError> {
    items.get(index).ok_or(EscrowError::InvalidMilestone)
}

fn save_milestone(env: &Env, index: u32, mut milestone: Milestone, state: MilestoneState) {
    let mut items = milestones(env);
    milestone.state = state.clone();
    items.set(index, milestone.clone());
    env.storage().instance().set(&DataKey::Milestones, &items);
    MilestoneChanged {
        agreement_hash: config(env).agreement_hash,
        index,
        amount: milestone.amount,
        state,
    }
    .publish(env);
}

#[contractimpl]
impl PactsetEscrow {
    #[allow(clippy::too_many_arguments)]
    pub fn __constructor(
        env: &Env,
        agreement_hash: BytesN<32>,
        agreement_version: u32,
        payer: Address,
        payee: Address,
        resolver: Address,
        asset: Address,
        amounts: Vec<i128>,
        terms_hash: BytesN<32>,
    ) -> Result<(), EscrowError> {
        if env.storage().instance().has(&DataKey::Config) {
            return Err(EscrowError::AlreadyInitialized);
        }
        if amounts.is_empty() {
            return Err(EscrowError::InvalidMilestones);
        }

        let mut total = 0_i128;
        let mut items = Vec::new(env);
        for amount in amounts.iter() {
            if amount <= 0 {
                return Err(EscrowError::InvalidAmount);
            }
            total = total
                .checked_add(amount)
                .ok_or(EscrowError::ArithmeticOverflow)?;
            items.push_back(Milestone {
                amount,
                state: MilestoneState::Pending,
            });
        }

        env.storage().instance().set(
            &DataKey::Config,
            &EscrowConfig {
                agreement_hash,
                agreement_version,
                payer,
                payee,
                resolver,
                asset,
                terms_hash,
                total_amount: total,
                funded: false,
            },
        );
        env.storage().instance().set(&DataKey::Milestones, &items);
        Ok(())
    }

    pub fn get_config(env: &Env) -> EscrowConfig {
        config(env)
    }

    pub fn get_milestones(env: &Env) -> Vec<Milestone> {
        milestones(env)
    }

    pub fn fund(env: &Env) -> Result<(), EscrowError> {
        let mut cfg = config(env);
        cfg.payer.require_auth();
        if cfg.funded {
            return Err(EscrowError::AlreadyFunded);
        }
        token::Client::new(env, &cfg.asset).transfer(
            &cfg.payer,
            &env.current_contract_address(),
            &cfg.total_amount,
        );
        cfg.funded = true;
        env.storage().instance().set(&DataKey::Config, &cfg);
        EscrowFunded {
            agreement_hash: cfg.agreement_hash,
            amount: cfg.total_amount,
        }
        .publish(env);
        Ok(())
    }

    pub fn submit(env: &Env, index: u32) -> Result<(), EscrowError> {
        let cfg = config(env);
        cfg.payee.require_auth();
        if !cfg.funded {
            return Err(EscrowError::NotFunded);
        }
        let item = milestone_at(&milestones(env), index)?;
        if item.state != MilestoneState::Pending
            && item.state != MilestoneState::CorrectionRequested
        {
            return Err(EscrowError::InvalidState);
        }
        save_milestone(env, index, item, MilestoneState::Submitted);
        Ok(())
    }

    pub fn request_correction(env: &Env, index: u32) -> Result<(), EscrowError> {
        let cfg = config(env);
        cfg.payer.require_auth();
        let item = milestone_at(&milestones(env), index)?;
        if item.state != MilestoneState::Submitted {
            return Err(EscrowError::InvalidState);
        }
        save_milestone(env, index, item, MilestoneState::CorrectionRequested);
        Ok(())
    }

    pub fn approve_release(env: &Env, index: u32) -> Result<(), EscrowError> {
        let cfg = config(env);
        cfg.payer.require_auth();
        if !cfg.funded {
            return Err(EscrowError::NotFunded);
        }
        let item = milestone_at(&milestones(env), index)?;
        if item.state != MilestoneState::Submitted {
            return Err(EscrowError::InvalidState);
        }
        save_milestone(env, index, item.clone(), MilestoneState::Released);
        token::Client::new(env, &cfg.asset).transfer(
            &env.current_contract_address(),
            &cfg.payee,
            &item.amount,
        );
        Ok(())
    }

    pub fn dispute(env: &Env, actor: Address, index: u32) -> Result<(), EscrowError> {
        actor.require_auth();
        let cfg = config(env);
        if actor != cfg.payer && actor != cfg.payee {
            return Err(EscrowError::Unauthorized);
        }
        let item = milestone_at(&milestones(env), index)?;
        if item.state == MilestoneState::Released || item.state == MilestoneState::Refunded {
            return Err(EscrowError::InvalidState);
        }
        save_milestone(env, index, item, MilestoneState::Disputed);
        Ok(())
    }

    pub fn resolve(
        env: &Env,
        index: u32,
        resolution: Resolution,
    ) -> Result<(), EscrowError> {
        let cfg = config(env);
        cfg.resolver.require_auth();
        let item = milestone_at(&milestones(env), index)?;
        if item.state != MilestoneState::Disputed {
            return Err(EscrowError::InvalidState);
        }
        match resolution {
            Resolution::ReleaseToPayee => {
                save_milestone(env, index, item.clone(), MilestoneState::Released);
                token::Client::new(env, &cfg.asset).transfer(
                    &env.current_contract_address(),
                    &cfg.payee,
                    &item.amount,
                );
            }
            Resolution::RefundToPayer => {
                save_milestone(env, index, item.clone(), MilestoneState::Refunded);
                token::Client::new(env, &cfg.asset).transfer(
                    &env.current_contract_address(),
                    &cfg.payer,
                    &item.amount,
                );
            }
        }
        Ok(())
    }

    pub fn mutual_refund_unreleased(env: &Env) -> Result<i128, EscrowError> {
        let cfg = config(env);
        cfg.payer.require_auth();
        cfg.payee.require_auth();
        if !cfg.funded {
            return Err(EscrowError::NotFunded);
        }

        let mut refunded = 0_i128;
        let mut items = milestones(env);
        for index in 0..items.len() {
            let mut item = items.get(index).unwrap();
            if item.state == MilestoneState::Pending
                || item.state == MilestoneState::Submitted
                || item.state == MilestoneState::CorrectionRequested
            {
                refunded = refunded
                    .checked_add(item.amount)
                    .ok_or(EscrowError::ArithmeticOverflow)?;
                item.state = MilestoneState::Refunded;
                items.set(index, item.clone());
                MilestoneChanged {
                    agreement_hash: cfg.agreement_hash.clone(),
                    index,
                    amount: item.amount,
                    state: MilestoneState::Refunded,
                }
                .publish(env);
            }
        }
        env.storage().instance().set(&DataKey::Milestones, &items);
        if refunded > 0 {
            token::Client::new(env, &cfg.asset).transfer(
                &env.current_contract_address(),
                &cfg.payer,
                &refunded,
            );
        }
        Ok(refunded)
    }
}

#[cfg(test)]
mod test;
