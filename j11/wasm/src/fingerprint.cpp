#include "fingerprint.h"
#include <algorithm>
#include <cmath>
#include <cstring>
#include <functional>
#include <unordered_map>

namespace audioproc {

FingerprintExtractor::FingerprintExtractor(const AudioConfig& config)
    : config_(config), fft_(config.frame_size) {
    buildHannWindow();
}

void FingerprintExtractor::buildHannWindow() {
    int N = config_.frame_size;
    window_.resize(N);
    double pi2 = 2.0 * M_PI;
    for (int i = 0; i < N; ++i) {
        window_[i] = 0.5 * (1.0 - std::cos(pi2 * static_cast<double>(i) / static_cast<double>(N - 1)));
    }
}

size_t FingerprintExtractor::numFrames(size_t sample_count) const {
    if (sample_count < static_cast<size_t>(config_.frame_size)) return 0;
    return (sample_count - config_.frame_size) / config_.hop_size + 1;
}

std::vector<std::vector<double>> FingerprintExtractor::computeSpectrogram(
    const std::vector<double>& signal) const {

    size_t total = signal.size();
    size_t n_frames = numFrames(total);
    if (n_frames == 0) return {};

    size_t n_bins = config_.frame_size / 2 + 1;
    std::vector<std::vector<double>> spectrogram(n_frames, std::vector<double>(n_bins));

    std::vector<Complex> frame_data(config_.frame_size);

    for (size_t f = 0; f < n_frames; ++f) {
        size_t start = f * config_.hop_size;
        for (int i = 0; i < config_.frame_size; ++i) {
            double val = 0.0;
            if (start + i < total) {
                val = signal[start + i];
            }
            frame_data[i] = Complex(val * window_[i], 0.0);
        }

        fft_.forward(frame_data);

        for (size_t b = 0; b < n_bins; ++b) {
            spectrogram[f][b] = std::abs(frame_data[b]);
        }
    }

    return spectrogram;
}

std::vector<Peak> FingerprintExtractor::findPeaks(
    const std::vector<std::vector<double>>& spectrogram) const {

    std::vector<Peak> peaks;
    if (spectrogram.empty()) return peaks;

    size_t n_frames = spectrogram.size();
    size_t n_bins = spectrogram[0].size();
    int win = config_.peak_window;

    for (size_t f = 0; f < n_frames; ++f) {
        for (size_t b = 1; b < n_bins - 1; ++b) {
            double mag = spectrogram[f][b];
            if (mag < config_.peak_threshold) continue;

            bool is_peak = true;
            int df_start = std::max(0, static_cast<int>(f) - win);
            int df_end = std::min(static_cast<int>(n_frames) - 1, static_cast<int>(f) + win);
            int db_start = std::max(1, static_cast<int>(b) - win);
            int db_end = std::min(static_cast<int>(n_bins) - 2, static_cast<int>(b) + win);

            for (int df = df_start; df <= df_end && is_peak; ++df) {
                for (int db = db_start; db <= db_end && is_peak; ++db) {
                    if (static_cast<size_t>(df) == f && static_cast<size_t>(db) == b) continue;
                    if (spectrogram[df][db] >= mag) {
                        is_peak = false;
                    }
                }
            }

            if (is_peak) {
                peaks.push_back({f, b, mag});
            }
        }
    }

    return peaks;
}

std::vector<Peak> FingerprintExtractor::extractPeaks(const std::vector<double>& signal) const {
    auto spec = computeSpectrogram(signal);
    return findPeaks(spec);
}

uint32_t hashPair(uint32_t f1, uint32_t f2, uint32_t dt) {
    uint32_t h = f1;
    h = h * 1000003 + f2;
    h = h * 1000003 + dt;
    return h;
}

std::vector<Fingerprint> FingerprintExtractor::generateFingerprints(
    const std::vector<Peak>& peaks) const {

    std::vector<Fingerprint> fps;
    size_t n = peaks.size();

    std::vector<Peak> sorted_peaks = peaks;
    std::sort(sorted_peaks.begin(), sorted_peaks.end(),
              [](const Peak& a, const Peak& b) {
                  if (a.frame != b.frame) return a.frame < b.frame;
                  return a.bin < b.bin;
              });

    for (size_t i = 0; i < n; ++i) {
        int count = 0;
        for (size_t j = i + 1; j < n && count < config_.fan_out; ++j) {
            int32_t dt = static_cast<int32_t>(sorted_peaks[j].frame) -
                        static_cast<int32_t>(sorted_peaks[i].frame);
            if (dt < config_.min_delta_t) continue;
            if (dt > config_.max_delta_t) break;

            uint32_t hash = hashPair(
                static_cast<uint32_t>(sorted_peaks[i].bin),
                static_cast<uint32_t>(sorted_peaks[j].bin),
                static_cast<uint32_t>(dt));

            fps.push_back({hash, static_cast<uint32_t>(sorted_peaks[i].frame)});
            ++count;
        }
    }

    return fps;
}

std::vector<Fingerprint> FingerprintExtractor::processSignal(
    const std::vector<float>& signal) const {

    std::vector<double> dsig(signal.begin(), signal.end());
    auto peaks = extractPeaks(dsig);
    return generateFingerprints(peaks);
}

} // namespace audioproc
