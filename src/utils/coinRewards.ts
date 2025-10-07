export const COIN_REWARDS = {
    CONTEST_PARTICIPATION: 50,
    CONTEST_FIRST_PLACE: 500,
    CONTEST_SECOND_PLACE: 300,
    CONTEST_THIRD_PLACE: 200,
    CONTEST_TOP_10: 100,
    DAILY_STREAK: 25,
    PROBLEM_SOLVED: 10,
    REFERRAL_BONUS: 500,
    WEEKLY_CHALLENGE: 150,
  };
  
  export const getContestReward = (rank: number, totalParticipants: number) => {
    if (rank === 1) return COIN_REWARDS.CONTEST_FIRST_PLACE;
    if (rank === 2) return COIN_REWARDS.CONTEST_SECOND_PLACE;
    if (rank === 3) return COIN_REWARDS.CONTEST_THIRD_PLACE;
    if (rank <= 10) return COIN_REWARDS.CONTEST_TOP_10;
    return COIN_REWARDS.CONTEST_PARTICIPATION;
  };