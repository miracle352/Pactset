#![no_std]

use soroban_sdk::{
    contract, contractclient, contracterror, contractevent, contractimpl, contracttype, token,
    Address, BytesN, Env, Vec,
};

const MAX_BOOKINGS: u32 = 8;

#[contract]
pub struct PactsetGo;

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum BundleState {
    CollectingAcceptances,
    AwaitingFunds,
    ReadyToActivate,
    Active,
    Expired,
    Refundable,
    Refunded,
    Cancelled,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct BookingInput {
    pub agreement_hash: BytesN<32>,
    pub agreement_version: u32,
    pub escrow: Address,
    pub provider: Address,
    pub amount: i128,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Booking {
    pub agreement_hash: BytesN<32>,
    pub agreement_version: u32,
    pub escrow: Address,
    pub provider: Address,
    pub amount: i128,
    pub consented: bool,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct BundleConfig {
    pub bundle_hash: BytesN<32>,
    pub organizer: Address,
    pub asset: Address,
    pub activation_deadline: u64,
    pub total_amount: i128,
    pub state: BundleState,
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

#[contractclient(name = "EscrowClient")]
pub trait EscrowInterface {
    fn get_config(env: &Env) -> EscrowConfig;
    fn fund(env: &Env);
}

#[contracttype]
#[derive(Clone)]
enum DataKey {
    Config,
    Bookings,
}

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum GoError {
    AlreadyInitialized = 1,
    InvalidBookingCount = 2,
    InvalidAmount = 3,
    ArithmeticOverflow = 4,
    DuplicateBooking = 5,
    InvalidDeadline = 6,
    InvalidIndex = 7,
    InvalidState = 8,
    WrongProvider = 9,
    MissingConsent = 10,
    DeadlinePassed = 11,
    DeadlineNotPassed = 12,
    EscrowMismatch = 13,
}

#[contractevent]
pub struct BundleChanged {
    #[topic]
    pub bundle_hash: BytesN<32>,
    pub state: BundleState,
}

#[contractevent]
pub struct ConsentChanged {
    #[topic]
    pub bundle_hash: BytesN<32>,
    #[topic]
    pub index: u32,
    pub consented: bool,
}

fn config(env: &Env) -> BundleConfig {
    env.storage().instance().get(&DataKey::Config).unwrap()
}

fn bookings(env: &Env) -> Vec<Booking> {
    env.storage().instance().get(&DataKey::Bookings).unwrap()
}

fn save_config(env: &Env, cfg: &BundleConfig) {
    env.storage().instance().set(&DataKey::Config, cfg);
    BundleChanged {
        bundle_hash: cfg.bundle_hash.clone(),
        state: cfg.state.clone(),
    }
    .publish(env);
}

fn all_consented(items: &Vec<Booking>) -> bool {
    for item in items.iter() {
        if !item.consented {
            return false;
        }
    }
    true
}

fn ensure_before_deadline(env: &Env, cfg: &BundleConfig) -> Result<(), GoError> {
    if env.ledger().timestamp() >= cfg.activation_deadline {
        return Err(GoError::DeadlinePassed);
    }
    Ok(())
}

#[contractimpl]
impl PactsetGo {
    pub fn __constructor(
        env: &Env,
        bundle_hash: BytesN<32>,
        organizer: Address,
        asset: Address,
        activation_deadline: u64,
        inputs: Vec<BookingInput>,
    ) -> Result<(), GoError> {
        if env.storage().instance().has(&DataKey::Config) {
            return Err(GoError::AlreadyInitialized);
        }
        if inputs.len() < 2 || inputs.len() > MAX_BOOKINGS {
            return Err(GoError::InvalidBookingCount);
        }
        if activation_deadline <= env.ledger().timestamp() {
            return Err(GoError::InvalidDeadline);
        }
        let mut total = 0_i128;
        let mut items = Vec::new(env);
        for input in inputs.iter() {
            if input.amount <= 0 {
                return Err(GoError::InvalidAmount);
            }
            for existing in items.iter() {
                let existing: Booking = existing;
                if existing.escrow == input.escrow
                    || existing.agreement_hash == input.agreement_hash
                {
                    return Err(GoError::DuplicateBooking);
                }
            }
            total = total
                .checked_add(input.amount)
                .ok_or(GoError::ArithmeticOverflow)?;
            items.push_back(Booking {
                agreement_hash: input.agreement_hash,
                agreement_version: input.agreement_version,
                escrow: input.escrow,
                provider: input.provider,
                amount: input.amount,
                consented: false,
            });
        }
        env.storage().instance().set(&DataKey::Bookings, &items);
        env.storage().instance().set(
            &DataKey::Config,
            &BundleConfig {
                bundle_hash,
                organizer,
                asset,
                activation_deadline,
                total_amount: total,
                state: BundleState::CollectingAcceptances,
            },
        );
        Ok(())
    }

    pub fn get_config(env: &Env) -> BundleConfig {
        config(env)
    }
    pub fn get_bookings(env: &Env) -> Vec<Booking> {
        bookings(env)
    }

    pub fn status(env: &Env) -> BundleState {
        let cfg = config(env);
        if env.ledger().timestamp() >= cfg.activation_deadline {
            if cfg.state == BundleState::ReadyToActivate {
                return BundleState::Refundable;
            }
            if cfg.state == BundleState::CollectingAcceptances
                || cfg.state == BundleState::AwaitingFunds
            {
                return BundleState::Expired;
            }
        }
        cfg.state
    }

    pub fn consent(env: &Env, index: u32) -> Result<(), GoError> {
        let mut cfg = config(env);
        ensure_before_deadline(env, &cfg)?;
        if cfg.state != BundleState::CollectingAcceptances
            && cfg.state != BundleState::AwaitingFunds
        {
            return Err(GoError::InvalidState);
        }
        let mut items = bookings(env);
        let mut item = items.get(index).ok_or(GoError::InvalidIndex)?;
        item.provider.require_auth();
        item.consented = true;
        items.set(index, item);
        cfg.state = if all_consented(&items) {
            BundleState::AwaitingFunds
        } else {
            BundleState::CollectingAcceptances
        };
        env.storage().instance().set(&DataKey::Bookings, &items);
        save_config(env, &cfg);
        ConsentChanged {
            bundle_hash: cfg.bundle_hash,
            index,
            consented: true,
        }
        .publish(env);
        Ok(())
    }

    pub fn revoke(env: &Env, index: u32) -> Result<(), GoError> {
        let mut cfg = config(env);
        ensure_before_deadline(env, &cfg)?;
        if cfg.state != BundleState::CollectingAcceptances
            && cfg.state != BundleState::AwaitingFunds
        {
            return Err(GoError::InvalidState);
        }
        let mut items = bookings(env);
        let mut item = items.get(index).ok_or(GoError::InvalidIndex)?;
        item.provider.require_auth();
        item.consented = false;
        items.set(index, item);
        cfg.state = BundleState::CollectingAcceptances;
        env.storage().instance().set(&DataKey::Bookings, &items);
        save_config(env, &cfg);
        ConsentChanged {
            bundle_hash: cfg.bundle_hash,
            index,
            consented: false,
        }
        .publish(env);
        Ok(())
    }

    pub fn reserve(env: &Env) -> Result<(), GoError> {
        let mut cfg = config(env);
        cfg.organizer.require_auth();
        ensure_before_deadline(env, &cfg)?;
        if cfg.state != BundleState::AwaitingFunds || !all_consented(&bookings(env)) {
            return Err(GoError::MissingConsent);
        }
        token::Client::new(env, &cfg.asset).transfer(
            &cfg.organizer,
            &env.current_contract_address(),
            &cfg.total_amount,
        );
        cfg.state = BundleState::ReadyToActivate;
        save_config(env, &cfg);
        Ok(())
    }

    pub fn activate(env: &Env) -> Result<(), GoError> {
        let mut cfg = config(env);
        cfg.organizer.require_auth();
        ensure_before_deadline(env, &cfg)?;
        if cfg.state != BundleState::ReadyToActivate {
            return Err(GoError::InvalidState);
        }
        let items = bookings(env);
        if !all_consented(&items) {
            return Err(GoError::MissingConsent);
        }
        for item in items.iter() {
            let escrow = EscrowClient::new(env, &item.escrow);
            let current = escrow.get_config();
            if current.funded
                || current.agreement_hash != item.agreement_hash
                || current.agreement_version != item.agreement_version
                || current.payer != cfg.organizer
                || current.payee != item.provider
                || current.asset != cfg.asset
                || current.total_amount != item.amount
            {
                return Err(GoError::EscrowMismatch);
            }
        }
        token::Client::new(env, &cfg.asset).transfer(
            &env.current_contract_address(),
            &cfg.organizer,
            &cfg.total_amount,
        );
        for item in items.iter() {
            EscrowClient::new(env, &item.escrow).fund();
        }
        cfg.state = BundleState::Active;
        save_config(env, &cfg);
        Ok(())
    }

    pub fn expire(env: &Env) -> Result<BundleState, GoError> {
        let mut cfg = config(env);
        if env.ledger().timestamp() < cfg.activation_deadline {
            return Err(GoError::DeadlineNotPassed);
        }
        cfg.state = match cfg.state {
            BundleState::ReadyToActivate => BundleState::Refundable,
            BundleState::CollectingAcceptances | BundleState::AwaitingFunds => BundleState::Expired,
            _ => return Err(GoError::InvalidState),
        };
        save_config(env, &cfg);
        Ok(cfg.state)
    }

    pub fn refund(env: &Env) -> Result<(), GoError> {
        let mut cfg = config(env);
        cfg.organizer.require_auth();
        if cfg.state == BundleState::ReadyToActivate
            && env.ledger().timestamp() >= cfg.activation_deadline
        {
            cfg.state = BundleState::Refundable;
        }
        if cfg.state != BundleState::Refundable {
            return Err(GoError::InvalidState);
        }
        token::Client::new(env, &cfg.asset).transfer(
            &env.current_contract_address(),
            &cfg.organizer,
            &cfg.total_amount,
        );
        cfg.state = BundleState::Refunded;
        save_config(env, &cfg);
        Ok(())
    }

    pub fn cancel(env: &Env) -> Result<(), GoError> {
        let mut cfg = config(env);
        cfg.organizer.require_auth();
        if matches!(
            cfg.state,
            BundleState::Active | BundleState::Cancelled | BundleState::Refunded
        ) {
            return Err(GoError::InvalidState);
        }
        if cfg.state == BundleState::ReadyToActivate {
            token::Client::new(env, &cfg.asset).transfer(
                &env.current_contract_address(),
                &cfg.organizer,
                &cfg.total_amount,
            );
        }
        cfg.state = BundleState::Cancelled;
        save_config(env, &cfg);
        Ok(())
    }
}

#[cfg(test)]
mod test;
