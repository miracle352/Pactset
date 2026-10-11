-- Register the audited Pactset Go v1 WASM uploaded to Stellar Testnet.
-- The hash is public contract metadata; no signing material is stored here.

alter table public.pactset_go_runtime_registry
  add constraint pactset_go_runtime_network_wasm_unique unique (network, wasm_hash);

update public.pactset_go_runtime_registry
set active = false
where network = 'TESTNET' and active;

insert into public.pactset_go_runtime_registry(network, contract_version, wasm_hash, active, max_bookings)
values ('TESTNET', 1, '94ffa39fafd6fca40fd21c128607eda25aabb26c8c80668fd16b243cacf9c245', true, 8)
on conflict (network, wasm_hash) do update
set contract_version = excluded.contract_version,
    active = excluded.active,
    max_bookings = excluded.max_bookings;

comment on constraint pactset_go_runtime_network_wasm_unique on public.pactset_go_runtime_registry
  is 'One registry record per uploaded WASM hash and network; only one may be active per network.';
