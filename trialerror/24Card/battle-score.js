function calculateScores(players, roundTimestamp) {
  const scored = players.map(p => {
    const solved = p.successTs != null;
    return {
      name: p.name,
      solved,
      timeTaken: solved ? Math.round((p.successTs - roundTimestamp) / 1000) : null,
      currentLife: p.life
    };
  });

  const solvedPlayers = scored.filter(p => p.solved);
  const unsolvedPlayers = scored.filter(p => !p.solved);

  const bombScore = Math.floor(scored.length * -2.5);

  if (solvedPlayers.length === 0) {
    const halfBomb = Math.floor(bombScore / 2);
    return scored.map(p => ({
      name: p.name,
      score: halfBomb,
      timeTaken: null,
      currentLife: p.currentLife,
      newLife: Math.max(0, p.currentLife + halfBomb)
    }));
  }

  solvedPlayers.sort((a, b) => a.timeTaken - b.timeTaken);

  const result = [];

  solvedPlayers.forEach((p, i) => {
    if (i === 0) {
      result.push({
        name: p.name,
        score: 0,
        timeTaken: p.timeTaken,
        currentLife: p.currentLife,
        newLife: p.currentLife
      });
      return;
    }
    const above = result[i - 1];
    const diff = p.timeTaken - solvedPlayers[i - 1].timeTaken;
    const extra = Math.ceil(Math.max(0, diff - 5) / 5);
    const score = above.score - 2 - extra;
    result.push({
      name: p.name,
      score,
      timeTaken: p.timeTaken,
      currentLife: p.currentLife,
      newLife: Math.max(0, p.currentLife + score)
    });
  });

  unsolvedPlayers.forEach(p => {
    result.push({
      name: p.name,
      score: bombScore,
      timeTaken: null,
      currentLife: p.currentLife,
      newLife: Math.max(0, p.currentLife + bombScore)
    });
  });

  result.sort((a, b) => {
    if (a.timeTaken === null && b.timeTaken === null) return 0;
    if (a.timeTaken === null) return 1;
    if (b.timeTaken === null) return -1;
    return a.timeTaken - b.timeTaken;
  });

  return result;
}
