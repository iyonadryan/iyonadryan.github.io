/**
 * calculateDuelScores
 *
 * Aturan scoring mode duel (1v1, 30 detik per ronde):
 *  - Keduanya tidak solve  → keduanya -5
 *  - Hanya satu yang solve dalam T detik → solver: 0, lawan: -(30 - T)
 *  - Keduanya solve        → masing-masing saling mengurangi life lawan
 *                            berdasarkan waktu solve sendiri
 *
 * @param {object} host   { name, life, successTs }
 * @param {object} enemy  { name, life, successTs }
 * @param {number} roundTimestamp  Timestamp kapan ronde dimulai (ms)
 * @returns {object} { host: result, enemy: result }
 *   result = { name, score, timeTaken, currentLife, newLife }
 */
function calculateDuelScores(host, enemy, roundTimestamp) {
  const ROUND_SECONDS = 30;
  const MIN_DAMAGE = 5;
  const MAX_DAMAGE = 20;
  const NO_SOLVE_PENALTY = -5;

  const hostSolved = host.successTs != null;
  const enemySolved = enemy.successTs != null;

  const hostTime = hostSolved
    ? Math.round((host.successTs - roundTimestamp) / 1000)
    : null;
  const enemyTime = enemySolved
    ? Math.round((enemy.successTs - roundTimestamp) / 1000)
    : null;

  // Damage = 5 + (sisa waktu / 30) * 15  → range 5–20
  // Solve di detik ke-0 → sisa 30 → damage 20
  // Solve di detik ke-30 → sisa 0 → damage 5
  function calcDamage(timeTaken) {
    const remaining = Math.max(0, ROUND_SECONDS - timeTaken);
    return Math.round(MIN_DAMAGE + (remaining / ROUND_SECONDS) * (MAX_DAMAGE - MIN_DAMAGE));
  }

  let hostScore = 0;
  let enemyScore = 0;

  if (!hostSolved && !enemySolved) {
    hostScore = NO_SOLVE_PENALTY;
    enemyScore = NO_SOLVE_PENALTY;
  } else {
    if (hostSolved) enemyScore = -calcDamage(hostTime);
    if (enemySolved) hostScore  = -calcDamage(enemyTime);
  }

  return {
    host: {
      name: host.name,
      score: hostScore,
      timeTaken: hostTime,
      currentLife: host.life,
      newLife: Math.max(0, host.life + hostScore)
    },
    enemy: {
      name: enemy.name,
      score: enemyScore,
      timeTaken: enemyTime,
      currentLife: enemy.life,
      newLife: Math.max(0, enemy.life + enemyScore)
    }
  };
}
