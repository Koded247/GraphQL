import { BigInt, Address, log } from "@graphprotocol/graph-ts";
import {
  EmergencyWithdrawn as EmergencyWithdrawnEvent,
  RewardRateUpdated as RewardRateUpdatedEvent,
  RewardsClaimed as RewardsClaimedEvent,
  Staked as StakedEvent,
  StakingInitialized as StakingInitializedEvent,
  StakingPaused as StakingPausedEvent,
  StakingUnpaused as StakingUnpausedEvent,
  TokenRecovered as TokenRecoveredEvent,
  Withdrawn as WithdrawnEvent
} from "../generated/StakingContract/StakingContract";
import {
  EmergencyWithdrawn,
  RewardRateUpdated,
  RewardsClaimed,
  Staked,
  StakingInitialized,
  StakingPaused,
  StakingUnpaused,
  TokenRecovered,
  Withdrawn
} from "../generated/schema";
import {
  getOrCreateStakingContract,
  getOrCreateUser,
  getOrCreateStakePosition,
  getOrCreateDailyStakingStat,
  updateUserCanWithdraw,
  BIG_INT_ONE,
  BIG_INT_ZERO
} from "./utils";

export function handleStaked(event: StakedEvent): void {

  // Create event entity

  let entity = new Staked(
    event.transaction.hash.concatI32(event.logIndex.toI32())
  );
  entity.user = event.params.user;
  entity.amount = event.params.amount;
  entity.timestamp = event.params.timestamp;
  entity.newTotalStaked = event.params.newTotalStaked;
  entity.currentRewardRate = event.params.currentRewardRate;
  entity.blockNumber = event.block.number;
  entity.blockTimestamp = event.block.timestamp;
  entity.transactionHash = event.transaction.hash;

  // i am Update the contract entity
  let contract = getOrCreateStakingContract(event.address);
  contract.totalStaked = event.params.newTotalStaked;
  contract.currentRewardRate = event.params.currentRewardRate;
  contract.lastUpdateTimestamp = event.block.timestamp;
  
  // Update or create the user entity
  let user = getOrCreateUser(event.params.user);

  
  // If this is the user's first stake, increment total users
  if (user.firstStakedAt.equals(BIG_INT_ZERO)) {
    contract.totalUsers = contract.totalUsers.plus(BIG_INT_ONE);
    user.firstStakedAt = event.block.timestamp;
  }
  
  user.stakedAmount = user.stakedAmount.plus(event.params.amount);
  user.totalStaked = user.totalStaked.plus(event.params.amount);
  user.lastStakeTimestamp = event.params.timestamp;
  user.stakeCount = user.stakeCount.plus(BIG_INT_ONE);
  user.lastActionAt = event.block.timestamp;
  
  // Create or update the stake position
  let position = getOrCreateStakePosition(event.params.user, event.params.timestamp);
  position.amount = position.amount.plus(event.params.amount);
  position.unlockTime = event.params.timestamp.plus(contract.minLockDuration);
  
  // Link the event to the user and position
  entity.staker = user.id;
  entity.position = position.id;
  
  // Update daily stats
  let dailyStats = getOrCreateDailyStakingStat(event.block.timestamp);
  dailyStats.dailyStakedAmount = dailyStats.dailyStakedAmount.plus(event.params.amount);
  dailyStats.endOfDayTotalStaked = event.params.newTotalStaked;
  dailyStats.endOfDayRewardRate = event.params.currentRewardRate;
  
  // Update unique stakers if needed
  let uniqueStakersToday = dailyStats.stakingEvents;
  if (!uniqueStakersToday.includes(event.params.user)) {
    dailyStats.uniqueStakers = dailyStats.uniqueStakers.plus(BIG_INT_ONE);
    let updatedEvents = dailyStats.stakingEvents;
    updatedEvents.push(event.params.user);
    dailyStats.stakingEvents = updatedEvents;
  }
  
  // Save entities
  contract.save();
  user.save();
  position.save();
  entity.save();
  dailyStats.save();
}

export function handleWithdrawn(event: WithdrawnEvent): void {
  // Create the event entity
  let entity = new Withdrawn(
    event.transaction.hash.concatI32(event.logIndex.toI32())
  );
  entity.user = event.params.user;
  entity.amount = event.params.amount;
  entity.timestamp = event.params.timestamp;
  entity.newTotalStaked = event.params.newTotalStaked;
  entity.currentRewardRate = event.params.currentRewardRate;
  entity.rewardsAccrued = event.params.rewardsAccrued;
  entity.blockNumber = event.block.number;
  entity.blockTimestamp = event.block.timestamp;
  entity.transactionHash = event.transaction.hash;

  // Update contract entity
  let contract = getOrCreateStakingContract(event.address);
  contract.totalStaked = event.params.newTotalStaked;
  contract.currentRewardRate = event.params.currentRewardRate;
  contract.lastUpdateTimestamp = event.block.timestamp;
  
  // Update user entity
  let user = getOrCreateUser(event.params.user);
  user.stakedAmount = user.stakedAmount.minus(event.params.amount);
  user.totalWithdrawn = user.totalWithdrawn.plus(event.params.amount);
  user.withdrawalCount = user.withdrawalCount.plus(BIG_INT_ONE);
  user.lastActionAt = event.block.timestamp;
  updateUserCanWithdraw(event.params.user, contract.minLockDuration);
  
 
  let positions = user.stakePositions;
  let foundPosition = false;
  
  
 
  let remainingWithdrawal = event.params.amount;
  
 
  let position = getOrCreateStakePosition(event.params.user, event.params.timestamp);
  position.withdrawnAmount = position.withdrawnAmount.plus(event.params.amount);
  
  
  if (position.amount.equals(position.withdrawnAmount)) {
    position.isActive = false;
  }
  

  entity.staker = user.id;
  entity.position = position.id;
  
 
  let dailyStats = getOrCreateDailyStakingStat(event.block.timestamp);
  dailyStats.dailyWithdrawnAmount = dailyStats.dailyWithdrawnAmount.plus(event.params.amount);
  dailyStats.endOfDayTotalStaked = event.params.newTotalStaked;
  dailyStats.endOfDayRewardRate = event.params.currentRewardRate;
  
  // Update unique withdrawers if needed
  let uniqueWithdrawersToday = dailyStats.withdrawalEvents;
  if (!uniqueWithdrawersToday.includes(event.params.user)) {
    dailyStats.uniqueWithdrawers = dailyStats.uniqueWithdrawers.plus(BIG_INT_ONE);
    let updatedEvents = dailyStats.withdrawalEvents;
    updatedEvents.push(event.params.user);
    dailyStats.withdrawalEvents = updatedEvents;
  }
  
  // Save all entities
  contract.save();
  user.save();
  position.save();
  entity.save();
  dailyStats.save();
}

export function handleRewardsClaimed(event: RewardsClaimedEvent): void {
  // Create the event entity
  let entity = new RewardsClaimed(
    event.transaction.hash.concatI32(event.logIndex.toI32())
  );
  entity.user = event.params.user;
  entity.amount = event.params.amount;
  entity.timestamp = event.params.timestamp;
  entity.newPendingRewards = event.params.newPendingRewards;
  entity.totalStaked = event.params.totalStaked;
  entity.blockNumber = event.block.number;
  entity.blockTimestamp = event.block.timestamp;
  entity.transactionHash = event.transaction.hash;

  // Update contract entity
  let contract = getOrCreateStakingContract(event.address);
  contract.totalRewardsDistributed = contract.totalRewardsDistributed.plus(event.params.amount);
  contract.lastUpdateTimestamp = event.block.timestamp;
  
  // Update user entity
  let user = getOrCreateUser(event.params.user);
  user.totalRewardsClaimed = user.totalRewardsClaimed.plus(event.params.amount);
  user.pendingRewards = event.params.newPendingRewards;
  user.rewardsClaimCount = user.rewardsClaimCount.plus(BIG_INT_ONE);
  user.lastActionAt = event.block.timestamp;
  
  // Link the event to the user
  entity.staker = user.id;
  
  // Update daily stats
  let dailyStats = getOrCreateDailyStakingStat(event.block.timestamp);
  dailyStats.dailyRewardsClaimed = dailyStats.dailyRewardsClaimed.plus(event.params.amount);
  
  // Update unique reward claimers if needed
  let uniqueClaimersToday = dailyStats.rewardClaimEvents;
  if (!uniqueClaimersToday.includes(event.params.user)) {
    dailyStats.uniqueRewardClaimers = dailyStats.uniqueRewardClaimers.plus(BIG_INT_ONE);
    let updatedEvents = dailyStats.rewardClaimEvents;
    updatedEvents.push(event.params.user);
    dailyStats.rewardClaimEvents = updatedEvents;
  }
  
  // Save all entities
  contract.save();
  user.save();
  entity.save();
  dailyStats.save();
}

export function handleEmergencyWithdrawn(event: EmergencyWithdrawnEvent): void {
  // Create the event entity
  let entity = new EmergencyWithdrawn(
    event.transaction.hash.concatI32(event.logIndex.toI32())
  );
  entity.user = event.params.user;
  entity.amount = event.params.amount;
  entity.penalty = event.params.penalty;
  entity.timestamp = event.params.timestamp;
  entity.newTotalStaked = event.params.newTotalStaked;
  entity.blockNumber = event.block.number;
  entity.blockTimestamp = event.block.timestamp;
  entity.transactionHash = event.transaction.hash;

  // Update contract entity
  let contract = getOrCreateStakingContract(event.address);
  contract.totalStaked = event.params.newTotalStaked;
  contract.lastUpdateTimestamp = event.block.timestamp;
  
  // Update user entity
  let user = getOrCreateUser(event.params.user);
  user.stakedAmount = BIG_INT_ZERO; // Emergency withdraw takes all staked amount
  user.totalWithdrawn = user.totalWithdrawn.plus(event.params.amount);
  user.pendingRewards = BIG_INT_ZERO; // Emergency withdraw resets pending rewards
  user.lastActionAt = event.block.timestamp;
  
  // Link the event to the user
  entity.staker = user.id;
  
 
  
  // Update daily stats
  let dailyStats = getOrCreateDailyStakingStat(event.block.timestamp);
  dailyStats.dailyWithdrawnAmount = dailyStats.dailyWithdrawnAmount.plus(event.params.amount);
  dailyStats.endOfDayTotalStaked = event.params.newTotalStaked;
  
  // Save all entities
  contract.save();
  user.save();
  entity.save();
  dailyStats.save();
}

export function handleRewardRateUpdated(event: RewardRateUpdatedEvent): void {
  // Create the event entity
  let entity = new RewardRateUpdated(
    event.transaction.hash.concatI32(event.logIndex.toI32())
  );
  entity.oldRate = event.params.oldRate;
  entity.newRate = event.params.newRate;
  entity.timestamp = event.params.timestamp;
  entity.totalStaked = event.params.totalStaked;
  entity.blockNumber = event.block.number;
  entity.blockTimestamp = event.block.timestamp;
  entity.transactionHash = event.transaction.hash;

  // Update contract entity
  let contract = getOrCreateStakingContract(event.address);
  contract.currentRewardRate = event.params.newRate;
  contract.lastUpdateTimestamp = event.block.timestamp;
  
  // Update daily stats
  let dailyStats = getOrCreateDailyStakingStat(event.block.timestamp);
  dailyStats.endOfDayRewardRate = event.params.newRate;
  dailyStats.endOfDayTotalStaked = event.params.totalStaked;
  
  // Save entities
  contract.save();
  entity.save();
  dailyStats.save();
}

export function handleStakingInitialized(event: StakingInitializedEvent): void {
  // Create the event entity
  let entity = new StakingInitialized(
    event.transaction.hash.concatI32(event.logIndex.toI32())
  );
  entity.stakingToken = event.params.stakingToken;
  entity.initialRewardRate = event.params.initialRewardRate;
  entity.timestamp = event.params.timestamp;
  entity.blockNumber = event.block.number;
  entity.blockTimestamp = event.block.timestamp;
  entity.transactionHash = event.transaction.hash;

  // Initialize the staking contract entity with initial values
  let contract = getOrCreateStakingContract(event.address);
  contract.stakingToken = event.params.stakingToken;
  contract.initialApr = event.params.initialRewardRate;
  contract.currentRewardRate = event.params.initialRewardRate;
  contract.lastUpdateTimestamp = event.block.timestamp;
  
  // Save entities
  contract.save();
  entity.save();
}

export function handleStakingPaused(event: StakingPausedEvent): void {
  // Create the event entity
  let entity = new StakingPaused(
    event.transaction.hash.concatI32(event.logIndex.toI32())
  );
  entity.timestamp = event.params.timestamp;
  entity.blockNumber = event.block.number;
  entity.blockTimestamp = event.block.timestamp;
  entity.transactionHash = event.transaction.hash;

  // Update contract entity
  let contract = getOrCreateStakingContract(event.address);
  contract.paused = true;
  
  // Save entities
  contract.save();
  entity.save();
}

export function handleStakingUnpaused(event: StakingUnpausedEvent): void {
  // Create the event entity
  let entity = new StakingUnpaused(
    event.transaction.hash.concatI32(event.logIndex.toI32())
  );
  entity.timestamp = event.params.timestamp;
  entity.blockNumber = event.block.number;
  entity.blockTimestamp = event.block.timestamp;
  entity.transactionHash = event.transaction.hash;

  // Update contract entity
  let contract = getOrCreateStakingContract(event.address);
  contract.paused = false;
  
  // Save entities
  contract.save();
  entity.save();
}

export function handleTokenRecovered(event: TokenRecoveredEvent): void {
  // Create the event entity
  let entity = new TokenRecovered(
    event.transaction.hash.concatI32(event.logIndex.toI32())
  );
  entity.token = event.params.token;
  entity.amount = event.params.amount;
  entity.timestamp = event.params.timestamp;
  entity.blockNumber = event.block.number;
  entity.blockTimestamp = event.block.timestamp;
  entity.transactionHash = event.transaction.hash;

  entity.save();
}