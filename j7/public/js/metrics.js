class MetricsManager {
    constructor() {
        this.elements = {
            bestBid: document.getElementById('bestBid'),
            bestAsk: document.getElementById('bestAsk'),
            spread: document.getElementById('spread'),
            spreadPct: document.getElementById('spreadPct'),
            imbalance: document.getElementById('imbalance'),
            imbalanceFill: document.getElementById('imbalanceFill'),
            eventProgress: document.getElementById('eventProgress'),
            progressFill: document.getElementById('progressFill'),
            currentTime: document.getElementById('currentTime'),
            startTime: document.getElementById('startTime'),
            endTime: document.getElementById('endTime'),
            timeSlider: document.getElementById('timeSlider'),
            sliderTooltip: document.getElementById('sliderTooltip'),
            timeDisplay: document.getElementById('timeDisplay'),
            statusDot: document.getElementById('statusDot'),
            statusText: document.getElementById('statusText'),
            actualVolatility: document.getElementById('actualVolatility'),
            predictedVolatility: document.getElementById('predictedVolatility'),
            predictionConfidence: document.getElementById('predictionConfidence'),
            confidenceFill: document.getElementById('confidenceFill')
        };
        
        this.prevBestBid = null;
        this.prevBestAsk = null;
        this.prevSpread = null;
        this.prevSpreadPct = null;
        this.prevImbalance = null;
        this.prevProcessed = null;
        this.prevTotal = null;
        this.prevCurrentTime = null;
        this.prevStartTime = null;
        this.prevEndTime = null;
        this.prevActualVolatility = null;
        this.prevPredictedVolatility = null;
        this.prevConfidence = null;
        this.animationFrame = 0;
    }

    update(snapshot, status) {
        if (snapshot && snapshot.bestBid !== undefined) {
            this.updateBestBid(snapshot.bestBid);
            this.updateBestAsk(snapshot.bestAsk);
            this.updateSpread(snapshot.spread, snapshot.bestBid);
            this.updateImbalance(snapshot.imbalance);
        }
        
        if (status) {
            this.updateProgress(status.processedEvents, status.totalEvents);
            this.updateTimeDisplay(status.currentTime, status.startTime, status.endTime);
        }
    }

    updateBestBid(price) {
        if (price === undefined || price === null) return;
        if (price === this.prevBestBid) return;
        
        const isUp = price > this.prevBestBid;
        this.animateValue(this.elements.bestBid, price, this.prevBestBid, isUp ? '#00d26a' : '#ff4757');
        this.prevBestBid = price;
    }

    updateBestAsk(price) {
        if (price === undefined || price === null) return;
        if (price === this.prevBestAsk) return;
        
        const isUp = price > this.prevBestAsk;
        this.animateValue(this.elements.bestAsk, price, this.prevBestAsk, isUp ? '#00d26a' : '#ff4757');
        this.prevBestAsk = price;
    }

    updateSpread(spread, bestBid) {
        if (spread === undefined || spread === null) return;
        
        if (spread !== this.prevSpread) {
            this.elements.spread.textContent = spread.toFixed(2);
            this.prevSpread = spread;
        }
        
        if (bestBid > 0) {
            const pct = (spread / bestBid) * 100;
            const pctStr = `${pct.toFixed(4)}%`;
            if (pctStr !== this.prevSpreadPct) {
                this.elements.spreadPct.textContent = pctStr;
                this.prevSpreadPct = pctStr;
            }
        }
    }

    updateImbalance(imbalance) {
        if (imbalance === undefined || imbalance === null) return;
        if (imbalance === this.prevImbalance) return;
        
        this.prevImbalance = imbalance;
        const pct = imbalance * 100;
        const displayValue = pct.toFixed(2) + '%';
        
        this.elements.imbalance.textContent = displayValue;
        
        const absPct = Math.abs(pct);
        const fillElement = this.elements.imbalanceFill;
        
        if (imbalance >= 0) {
            fillElement.style.width = absPct + '%';
            fillElement.style.marginLeft = '50%';
            fillElement.style.transform = 'translateX(-100%)';
            fillElement.classList.remove('negative');
        } else {
            fillElement.style.width = absPct + '%';
            fillElement.style.marginLeft = '50%';
            fillElement.style.transform = 'translateX(0%)';
            fillElement.classList.add('negative');
        }
        
        if (imbalance > 0.5) {
            this.elements.imbalance.style.color = '#00d26a';
            this.elements.imbalance.style.textShadow = '0 0 10px rgba(0, 210, 106, 0.5)';
        } else if (imbalance < -0.5) {
            this.elements.imbalance.style.color = '#ff4757';
            this.elements.imbalance.style.textShadow = '0 0 10px rgba(255, 71, 87, 0.5)';
        } else {
            this.elements.imbalance.style.color = '#f0f6fc';
            this.elements.imbalance.style.textShadow = 'none';
        }
    }

    updateProgress(processed, total) {
        if (processed === this.prevProcessed && total === this.prevTotal) return;
        
        this.prevProcessed = processed;
        this.prevTotal = total;
        this.elements.eventProgress.textContent = `${processed.toLocaleString()} / ${total.toLocaleString()}`;
        
        const pct = total > 0 ? (processed / total) * 100 : 0;
        this.elements.progressFill.style.width = pct + '%';
    }

    updateTimeDisplay(currentTime, startTime, endTime) {
        if (startTime !== this.prevStartTime) {
            this.elements.startTime.textContent = this.formatTime(startTime);
            this.prevStartTime = startTime;
        }
        if (endTime !== this.prevEndTime) {
            this.elements.endTime.textContent = this.formatTime(endTime);
            this.prevEndTime = endTime;
        }
        if (currentTime !== this.prevCurrentTime) {
            this.elements.currentTime.textContent = this.formatTime(currentTime);
            this.prevCurrentTime = currentTime;
        }
        
        const range = endTime - startTime;
        if (range > 0) {
            const value = ((currentTime - startTime) / range) * 1000;
            if (value !== parseFloat(this.elements.timeSlider.value)) {
                this.elements.timeSlider.value = value;
            }
        }
    }

    updateVolatilityPrediction(prediction) {
        if (!prediction) return;
        
        const actualPct = (prediction.actualVolatility * 100).toFixed(4) + '%';
        if (actualPct !== this.prevActualVolatility) {
            this.elements.actualVolatility.textContent = actualPct;
            this.prevActualVolatility = actualPct;
        }
        
        const predictedPct = (prediction.predictedVolatility * 100).toFixed(4) + '%';
        if (predictedPct !== this.prevPredictedVolatility) {
            this.elements.predictedVolatility.textContent = predictedPct;
            this.prevPredictedVolatility = predictedPct;
        }
        
        const confidencePct = (prediction.confidence * 100).toFixed(1) + '%';
        if (confidencePct !== this.prevConfidence) {
            this.elements.predictionConfidence.textContent = confidencePct;
            this.elements.confidenceFill.style.width = (prediction.confidence * 100) + '%';
            this.prevConfidence = confidencePct;
        }
    }

    updateSystemTime() {
        const now = new Date();
        this.elements.timeDisplay.textContent = now.toLocaleTimeString('zh-CN', { hour12: false });
    }

    updateConnectionStatus(connected) {
        if (connected) {
            this.elements.statusDot.classList.add('connected');
            this.elements.statusDot.classList.remove('disconnected');
            this.elements.statusText.textContent = '已连接';
        } else {
            this.elements.statusDot.classList.remove('connected');
            this.elements.statusDot.classList.add('disconnected');
            this.elements.statusText.textContent = '连接断开';
        }
    }

    updateSliderTooltip(timestamp) {
        this.elements.sliderTooltip.textContent = this.formatTime(timestamp);
    }

    animateValue(element, newValue, oldValue, flashColor) {
        const originalColor = element.style.color;
        
        element.style.color = flashColor;
        element.style.transition = 'color 0.1s ease';
        
        element.textContent = newValue.toFixed(2);
        
        setTimeout(() => {
            element.style.color = originalColor;
        }, 200);
    }

    formatTime(timestamp) {
        const date = new Date(timestamp);
        return date.toLocaleTimeString('zh-CN', { 
            hour12: false,
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
        });
    }

    setPlaybackSpeed(speed) {
        document.querySelectorAll('.speed-btn').forEach(btn => {
            if (parseFloat(btn.dataset.speed) === speed) {
                btn.classList.add('active');
            } else {
                btn.classList.remove('active');
            }
        });
    }

    updatePlayButton(isPlaying) {
        const playIcon = document.querySelector('.play-icon');
        const pauseIcon = document.querySelector('.pause-icon');
        
        if (isPlaying) {
            playIcon.classList.add('hidden');
            pauseIcon.classList.remove('hidden');
        } else {
            playIcon.classList.remove('hidden');
            pauseIcon.classList.add('hidden');
        }
    }
}
