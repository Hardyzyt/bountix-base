-- =====================================================================
-- Bountix: FCFS escrow contract address safety
-- =====================================================================
--
-- FCFS escrow funding happens against BountixEscrowV2. Keep the schema,
-- existing data, and future writes aligned so FCFS refund/release flows do
-- not accidentally target the older escrow contracts.
-- =====================================================================

alter table public.tasks
  drop constraint if exists tasks_reward_mode_ck;

alter table public.tasks
  add constraint tasks_reward_mode_ck
  check (reward_mode in ('fixed', 'raffle', 'fcfs'))
  not valid;

alter table public.tasks
  validate constraint tasks_reward_mode_ck;

update public.tasks
set escrow_contract_address = '0xdf680c699B705eB0e301fD83cA4A066F97a70f31'
where reward_mode = 'fcfs'
  and payment_method = 'escrow_base'
  and escrow_tx_hash is not null
  and coalesce(lower(escrow_contract_address), '') <>
    lower('0xdf680c699B705eB0e301fD83cA4A066F97a70f31');

alter table public.tasks
  drop constraint if exists tasks_fcfs_escrow_contract_ck;

alter table public.tasks
  add constraint tasks_fcfs_escrow_contract_ck
  check (
    reward_mode <> 'fcfs'
    or payment_method <> 'escrow_base'
    or escrow_tx_hash is null
    or lower(coalesce(escrow_contract_address, '')) =
      lower('0xdf680c699B705eB0e301fD83cA4A066F97a70f31')
  )
  not valid;

alter table public.tasks
  validate constraint tasks_fcfs_escrow_contract_ck;

comment on column public.tasks.reward_mode is
  'Reward payout mode: fixed, raffle, or fcfs. FCFS escrow funding uses BountixEscrowV2.';
