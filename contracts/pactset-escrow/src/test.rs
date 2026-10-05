extern crate std;

use super::*;
use soroban_sdk::{
    testutils::{Address as _, MockAuth, MockAuthInvoke},
    token::{Client as TokenClient, StellarAssetClient},
    vec, Address, BytesN, Env, IntoVal,
};

struct Setup<'a> {
    env: Env,
    contract: Address,
    client: PactsetEscrowClient<'a>,
    token: Address,
    payer: Address,
    payee: Address,
    resolver: Address,
}

fn setup() -> Setup<'static> {
    let env = Env::default();
    env.mock_all_auths();
    let admin = Address::generate(&env);
    let payer = Address::generate(&env);
    let payee = Address::generate(&env);
    let resolver = Address::generate(&env);
    let token = env.register_stellar_asset_contract_v2(admin.clone()).address();
    StellarAssetClient::new(&env, &token).mint(&payer, &3_000_0000);
    let agreement_hash = BytesN::from_array(&env, &[7; 32]);
    let terms_hash = BytesN::from_array(&env, &[9; 32]);
    let amounts = vec![&env, 1_000_0000_i128, 2_000_0000_i128];
    let contract = env.register(
        PactsetEscrow,
        (
            agreement_hash,
            4_u32,
            payer.clone(),
            payee.clone(),
            resolver.clone(),
            token.clone(),
            amounts,
            terms_hash,
        ),
    );
    let client = PactsetEscrowClient::new(&env, &contract);
    Setup {
        env,
        contract,
        client,
        token,
        payer,
        payee,
        resolver,
    }
}

#[test]
fn funds_submits_and_releases_exact_amount_once() {
    let s = setup();
    let token = TokenClient::new(&s.env, &s.token);
    s.client.fund();
    assert_eq!(token.balance(&s.contract), 3_000_0000);

    s.client.submit(&0);
    s.client.approve_release(&0);
    assert_eq!(token.balance(&s.payee), 1_000_0000);
    assert_eq!(token.balance(&s.contract), 2_000_0000);
    assert!(s.client.try_approve_release(&0).is_err());
}

#[test]
fn disputed_milestone_cannot_be_approved_and_resolver_can_refund() {
    let s = setup();
    let token = TokenClient::new(&s.env, &s.token);
    s.client.fund();
    s.client.submit(&0);
    s.client.dispute(&s.payee, &0);
    assert!(s.client.try_approve_release(&0).is_err());
    s.client.resolve(&0, &Resolution::RefundToPayer);
    assert_eq!(token.balance(&s.payer), 1_000_0000);
    assert_eq!(token.balance(&s.contract), 2_000_0000);
}

#[test]
fn mutual_refund_skips_disputed_and_released_milestones() {
    let s = setup();
    let token = TokenClient::new(&s.env, &s.token);
    s.client.fund();
    s.client.submit(&0);
    s.client.approve_release(&0);
    let refunded = s.client.mutual_refund_unreleased();
    assert_eq!(refunded, 2_000_0000);
    assert_eq!(token.balance(&s.payee), 1_000_0000);
    assert_eq!(token.balance(&s.payer), 2_000_0000);
    assert_eq!(token.balance(&s.contract), 0);
}

#[test]
fn unrelated_actor_is_rejected_before_state_change() {
    let s = setup();
    let stranger = Address::generate(&s.env);
    let invoke = MockAuthInvoke {
        contract: &s.contract,
        fn_name: "dispute",
        args: (stranger.clone(), 0_u32).into_val(&s.env),
        sub_invokes: &[],
    };
    let result = s
        .client
        .mock_auths(&[MockAuth {
            address: &stranger,
            invoke: &invoke,
        }])
        .try_dispute(&stranger, &0);
    assert!(result.is_err());
    assert_eq!(s.client.get_milestones().get(0).unwrap().state, MilestoneState::Pending);
}

#[test]
fn separate_contracts_cannot_spend_each_others_funds() {
    let s = setup();
    s.client.fund();
    let first_balance = TokenClient::new(&s.env, &s.token).balance(&s.contract);
    let other_payer = Address::generate(&s.env);
    StellarAssetClient::new(&s.env, &s.token).mint(&other_payer, &1_000_0000);
    let other = s.env.register(
        PactsetEscrow,
        (
            BytesN::from_array(&s.env, &[3; 32]),
            1_u32,
            other_payer,
            Address::generate(&s.env),
            s.resolver,
            s.token.clone(),
            vec![&s.env, 1_000_0000_i128],
            BytesN::from_array(&s.env, &[4; 32]),
        ),
    );
    let other_client = PactsetEscrowClient::new(&s.env, &other);
    other_client.fund();
    assert_eq!(TokenClient::new(&s.env, &s.token).balance(&s.contract), first_balance);
    assert_eq!(TokenClient::new(&s.env, &s.token).balance(&other), 1_000_0000);
}
