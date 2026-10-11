extern crate std;

use super::*;
use pactset_escrow::{PactsetEscrow, PactsetEscrowClient};
use soroban_sdk::{
    testutils::{Address as _, Ledger as _, MockAuth, MockAuthInvoke},
    token::{Client as TokenClient, StellarAssetClient},
    vec, Address, BytesN, Env, IntoVal, Vec,
};

struct Setup<'a> {
    env: Env,
    bundle: Address,
    client: PactsetGoClient<'a>,
    token: Address,
    organizer: Address,
    providers: Vec<Address>,
    escrows: Vec<Address>,
    deadline: u64,
}

fn make_escrow(
    env: &Env,
    token: &Address,
    organizer: &Address,
    provider: &Address,
    seed: u8,
    amount: i128,
    version: u32,
) -> Address {
    env.register(
        PactsetEscrow,
        (
            BytesN::from_array(env, &[seed; 32]),
            version,
            organizer.clone(),
            provider.clone(),
            Address::generate(env),
            token.clone(),
            vec![env, amount],
            BytesN::from_array(env, &[seed + 20; 32]),
        ),
    )
}

fn setup() -> Setup<'static> {
    let env = Env::default();
    env.mock_all_auths();
    let admin = Address::generate(&env);
    let organizer = Address::generate(&env);
    let token = env
        .register_stellar_asset_contract_v2(admin.clone())
        .address();
    StellarAssetClient::new(&env, &token).mint(&organizer, &100_000_0000);
    let mut providers = Vec::new(&env);
    let mut escrows = Vec::new(&env);
    let mut inputs = Vec::new(&env);
    for index in 0..3_u32 {
        let provider = Address::generate(&env);
        let amount = (index as i128 + 1) * 10_000_000;
        let seed = index as u8 + 1;
        let escrow = make_escrow(&env, &token, &organizer, &provider, seed, amount, index + 1);
        providers.push_back(provider.clone());
        escrows.push_back(escrow.clone());
        inputs.push_back(BookingInput {
            agreement_hash: BytesN::from_array(&env, &[seed; 32]),
            agreement_version: index + 1,
            escrow,
            provider,
            amount,
        });
    }
    let deadline = 10_000;
    let bundle = env.register(
        PactsetGo,
        (
            BytesN::from_array(&env, &[42; 32]),
            organizer.clone(),
            token.clone(),
            deadline,
            inputs,
        ),
    );
    let client = PactsetGoClient::new(&env, &bundle);
    Setup {
        env,
        bundle,
        client,
        token,
        organizer,
        providers,
        escrows,
        deadline,
    }
}

fn consent_all(setup: &Setup<'_>) {
    for index in 0..setup.providers.len() {
        setup.client.consent(&index);
    }
}

fn advance(setup: &Setup<'_>, timestamp: u64) {
    setup.env.ledger().set_timestamp(timestamp);
}

#[test]
fn activates_three_escrows_atomically_after_exact_consents_and_reservation() {
    let s = setup();
    consent_all(&s);
    assert_eq!(s.client.status(), BundleState::AwaitingFunds);
    s.client.reserve();
    assert_eq!(
        TokenClient::new(&s.env, &s.token).balance(&s.bundle),
        60_000_000
    );
    assert_eq!(s.client.status(), BundleState::ReadyToActivate);
    s.client.activate();
    assert_eq!(s.client.status(), BundleState::Active);
    assert_eq!(TokenClient::new(&s.env, &s.token).balance(&s.bundle), 0);
    for index in 0..s.escrows.len() {
        let escrow = s.escrows.get(index).unwrap();
        let expected = (index as i128 + 1) * 10_000_000;
        assert!(
            PactsetEscrowClient::new(&s.env, &escrow)
                .get_config()
                .funded
        );
        assert_eq!(
            TokenClient::new(&s.env, &s.token).balance(&escrow),
            expected
        );
    }
    assert!(s.client.try_activate().is_err());
}

#[test]
fn missing_or_revoked_acceptance_blocks_reservation() {
    let s = setup();
    s.client.consent(&0);
    s.client.consent(&1);
    assert!(s.client.try_reserve().is_err());
    s.client.consent(&2);
    s.client.revoke(&1);
    assert_eq!(s.client.status(), BundleState::CollectingAcceptances);
    assert!(s.client.try_reserve().is_err());
}

#[test]
fn changed_agreement_version_leaves_every_escrow_unchanged() {
    let env = Env::default();
    env.mock_all_auths();
    let admin = Address::generate(&env);
    let organizer = Address::generate(&env);
    let token = env
        .register_stellar_asset_contract_v2(admin.clone())
        .address();
    StellarAssetClient::new(&env, &token).mint(&organizer, &50_000_000);
    let provider_a = Address::generate(&env);
    let provider_b = Address::generate(&env);
    let escrow_a = make_escrow(&env, &token, &organizer, &provider_a, 1, 10_000_000, 1);
    let escrow_b = make_escrow(&env, &token, &organizer, &provider_b, 2, 20_000_000, 2);
    let inputs = vec![
        &env,
        BookingInput {
            agreement_hash: BytesN::from_array(&env, &[1; 32]),
            agreement_version: 1,
            escrow: escrow_a.clone(),
            provider: provider_a,
            amount: 10_000_000,
        },
        BookingInput {
            agreement_hash: BytesN::from_array(&env, &[2; 32]),
            agreement_version: 99,
            escrow: escrow_b.clone(),
            provider: provider_b,
            amount: 20_000_000,
        },
    ];
    let bundle = env.register(
        PactsetGo,
        (
            BytesN::from_array(&env, &[7; 32]),
            organizer,
            token.clone(),
            10_000_u64,
            inputs,
        ),
    );
    let client = PactsetGoClient::new(&env, &bundle);
    client.consent(&0);
    client.consent(&1);
    client.reserve();
    assert!(client.try_activate().is_err());
    assert!(
        !PactsetEscrowClient::new(&env, &escrow_a)
            .get_config()
            .funded
    );
    assert!(
        !PactsetEscrowClient::new(&env, &escrow_b)
            .get_config()
            .funded
    );
    assert_eq!(TokenClient::new(&env, &token).balance(&bundle), 30_000_000);
}

#[test]
fn insufficient_balance_does_not_change_ready_state_or_custody() {
    let s = setup();
    consent_all(&s);
    StellarAssetClient::new(&s.env, &s.token).burn(&s.organizer, &100_000_0000);
    assert!(s.client.try_reserve().is_err());
    assert_eq!(s.client.status(), BundleState::AwaitingFunds);
    assert_eq!(TokenClient::new(&s.env, &s.token).balance(&s.bundle), 0);
}

#[test]
fn expiry_refund_is_exact_and_single_use() {
    let s = setup();
    consent_all(&s);
    let before = TokenClient::new(&s.env, &s.token).balance(&s.organizer);
    s.client.reserve();
    advance(&s, s.deadline);
    assert_eq!(s.client.status(), BundleState::Refundable);
    s.client.refund();
    assert_eq!(s.client.status(), BundleState::Refunded);
    assert_eq!(
        TokenClient::new(&s.env, &s.token).balance(&s.organizer),
        before
    );
    assert!(s.client.try_refund().is_err());
}

#[test]
fn one_prefunded_booking_reverts_the_whole_activation() {
    let s = setup();
    consent_all(&s);
    s.client.reserve();
    PactsetEscrowClient::new(&s.env, &s.escrows.get(1).unwrap()).fund();
    let first = s.escrows.get(0).unwrap();
    let third = s.escrows.get(2).unwrap();
    assert!(s.client.try_activate().is_err());
    assert!(!PactsetEscrowClient::new(&s.env, &first).get_config().funded);
    assert!(!PactsetEscrowClient::new(&s.env, &third).get_config().funded);
    assert_eq!(s.client.status(), BundleState::ReadyToActivate);
    assert_eq!(
        TokenClient::new(&s.env, &s.token).balance(&s.bundle),
        60_000_000
    );
}

#[test]
fn stranger_cannot_activate_or_refund() {
    let s = setup();
    consent_all(&s);
    s.client.reserve();
    let stranger = Address::generate(&s.env);
    let invoke = MockAuthInvoke {
        contract: &s.bundle,
        fn_name: "activate",
        args: ().into_val(&s.env),
        sub_invokes: &[],
    };
    assert!(s
        .client
        .mock_auths(&[MockAuth {
            address: &stranger,
            invoke: &invoke
        }])
        .try_activate()
        .is_err());
    assert_eq!(s.client.status(), BundleState::ReadyToActivate);
}

#[test]
fn cancellation_returns_reserved_funds_without_touching_escrows() {
    let s = setup();
    consent_all(&s);
    let before = TokenClient::new(&s.env, &s.token).balance(&s.organizer);
    s.client.reserve();
    s.client.cancel();
    assert_eq!(s.client.status(), BundleState::Cancelled);
    assert_eq!(
        TokenClient::new(&s.env, &s.token).balance(&s.organizer),
        before
    );
    for escrow in s.escrows.iter() {
        assert!(
            !PactsetEscrowClient::new(&s.env, &escrow)
                .get_config()
                .funded
        );
    }
    assert!(s.client.try_cancel().is_err());
}

#[test]
fn a_second_bundle_cannot_replay_already_funded_escrows() {
    let s = setup();
    consent_all(&s);
    s.client.reserve();
    s.client.activate();

    let mut inputs = Vec::new(&s.env);
    for index in 0..s.escrows.len() {
        inputs.push_back(BookingInput {
            agreement_hash: BytesN::from_array(&s.env, &[index as u8 + 1; 32]),
            agreement_version: index + 1,
            escrow: s.escrows.get(index).unwrap(),
            provider: s.providers.get(index).unwrap(),
            amount: (index as i128 + 1) * 10_000_000,
        });
    }
    let second_address = s.env.register(
        PactsetGo,
        (
            BytesN::from_array(&s.env, &[99; 32]),
            s.organizer.clone(),
            s.token.clone(),
            s.deadline,
            inputs,
        ),
    );
    let second = PactsetGoClient::new(&s.env, &second_address);
    for index in 0..s.providers.len() {
        second.consent(&index);
    }
    second.reserve();
    assert!(second.try_activate().is_err());
    assert_eq!(second.status(), BundleState::ReadyToActivate);
    assert_eq!(
        TokenClient::new(&s.env, &s.token).balance(&second_address),
        60_000_000
    );
}
