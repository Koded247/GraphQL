import { BigInt, Address, ethereum } from "@graphprotocol/graph-ts";
import { 
  StakingContract as StakingContractEntity, 
  User, 
  StakePosition,
  DailyStakingStat
} from "../generated/schema";

export const ADDRESS_ZERO = "0x0000000000000000000000000000000000000000";
export const BIG_INT_ZERO = BigInt.fromI32(0);
export const BIG_INT_ONE = BigInt.fromI32(1);

export function getOrCreateStakingContract(address: Address): StakingContractEntity {
  let contract = StakingContractEntity.load(address.toHexString());
  
  if (contract == null) {
    contract = new StakingContractEntity(address.toHexString());
    contract.stakingToken = Address.fromString(ADDRESS_ZERO);
    contract.initialApr = BIG_INT_ZERO;
    contract.minLockDuration = BIG_INT_ZERO;
    contract.aprReductionPerThousand = BIG_INT_ZERO;
    contract.emergencyWithdrawPenalty = BIG_INT_ZERO;
    contract.totalStaked = BIG_INT_ZERO;
    contract.currentRewardRate = BIG_INT_ZERO;
    contract.lastUpdateTimestamp = BIG_INT_ZERO;
    contract.totalUsers = BIG_INT_ZERO;
    contract.paused = false;
    contract.owner = Address.fromString(ADDRESS_ZERO);
    contract.totalRewardsDistributed = BIG_INT_ZERO;
    contract.save();
  }
  
  return contract;
}

export function getOrCreateUser(address: Address): User {
  let user = User.load(address);
  
  if (user == null) {
    user = new User(address);
    user.stakedAmount = BIG_INT_ZERO;
    user.totalStaked = BIG_INT_ZERO;
    user.totalWithdrawn = BIG_INT_ZERO;
    user.totalRewardsClaimed = BIG_INT_ZERO;
    user.lastStakeTimestamp = BIG_INT_ZERO;
    user.stakeCount = BIG_INT_ZERO;
    user.withdrawalCount = BIG_INT_ZERO;
    user.rewardsClaimCount = BIG_INT_ZERO;
    user.pendingRewards = BIG_INT_ZERO;
    user.canWithdraw = false;
    user.firstStakedAt = BIG_INT_ZERO;
    user.lastActionAt = BIG_INT_ZERO;
    user.save();
  }
  
  return user;
}

export function getOrCreateStakePosition(userAddress: Address, timestamp: BigInt): StakePosition {
  let id = userAddress.toHexString() + "-" + timestamp.toString();
  let position = StakePosition.load(id);
  
  if (position == null) {
    position = new StakePosition(id);
    let user = getOrCreateUser(userAddress);
    position.user = user.id;
    position.amount = BIG_INT_ZERO;
    position.timestamp = timestamp;
    position.lastUpdateTimestamp = timestamp;
    position.unlockTime = BIG_INT_ZERO;
    position.isActive = true;
    position.withdrawnAmount = BIG_INT_ZERO;
    position.rewardsClaimed = BIG_INT_ZERO;
    position.pendingRewards = BIG_INT_ZERO;
    position.save();
  }
  
  return position;
}

export function getOrCreateDailyStakingStat(timestamp: BigInt): DailyStakingStat {
  const dayTimestamp = timestamp.toI32() / 86400 * 86400; // Truncate to day (86400 seconds in a day)
  const dayId = dayTimestamp.toString();
  
  let stats = DailyStakingStat.load(dayId);
  
  if (stats == null) {
    stats = new DailyStakingStat(dayId);
    const date = new Date(dayTimestamp * 1000);
    stats.date = date.toISOString().split('T')[0]; // Format as YYYY-MM-DD for the date  time
    stats.dailyStakedAmount = BIG_INT_ZERO;
    stats.dailyWithdrawnAmount = BIG_INT_ZERO;
    stats.dailyRewardsClaimed = BIG_INT_ZERO;
    stats.uniqueStakers = BIG_INT_ZERO;
    stats.uniqueWithdrawers = BIG_INT_ZERO;
    stats.uniqueRewardClaimers = BIG_INT_ZERO;
    stats.endOfDayTotalStaked = BIG_INT_ZERO;
    stats.endOfDayRewardRate = BIG_INT_ZERO;
    stats.stakingEvents = [];
    stats.withdrawalEvents = [];
    stats.rewardClaimEvents = [];
    stats.save();
  }
  
  return stats;
}

export function updateUserCanWithdraw(userAddress: Address, minLockDuration: BigInt): void {
  let user = getOrCreateUser(userAddress);
  const currentTime = BigInt.fromI64(Date.now() / 1000);
  
  // Update canWithdraw flag based on lock duration
  if (user.lastStakeTimestamp.plus(minLockDuration).le(currentTime)) {
    user.canWithdraw = true;
  } else {
    user.canWithdraw = false;
  }
  
  user.save();
}