self.onmessage = function (e) {
  const { taskId, number, rangeStart, rangeEnd } = e.data;
  const factors = [];
  const n = BigInt(number);
  let current = BigInt(rangeStart);
  const end = BigInt(rangeEnd);
  const totalSteps = Number(end - current);
  let stepsDone = 0;
  const reportInterval = Math.max(Math.floor(totalSteps / 10), 1);

  while (current <= end) {
    if (n % current === 0n) {
      factors.push(current.toString());
      const complement = n / current;
      if (complement !== current) {
        factors.push(complement.toString());
      }
    }
    current += 1n;
    stepsDone++;

    if (stepsDone % reportInterval === 0) {
      self.postMessage({
        type: 'progress',
        taskId,
        percent: Math.min(Math.round((stepsDone / totalSteps) * 100), 100),
      });
    }
  }

  self.postMessage({
    type: 'result',
    taskId,
    number: number,
    rangeStart,
    rangeEnd,
    factors: factors,
  });
};
