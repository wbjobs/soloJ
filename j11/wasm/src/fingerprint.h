#ifndef AUDIO_FINGERPRINT_FINGERPRINT_H
#define AUDIO_FINGERPRINT_FINGERPRINT_H

#include "fft.h"
#include <cstdint>
#include <string>
#include <vector>

namespace audioproc {

struct Peak {
    size_t frame;
    size_t bin;
    double magnitude;
};

struct Fingerprint {
    uint32_t hash;
    uint32_t offset;
};

struct AudioConfig {
    int sample_rate;
    int frame_size;
    int hop_size;
    int peak_window;
    double peak_threshold;
    int fan_out;
    int max_delta_t;
    int min_delta_t;
};

constexpr AudioConfig kDefaultConfig = {
    44100,
    4096,
    1024,
    15,
    0.0,
    5,
    200,
    5
};

class FingerprintExtractor {
public:
    FingerprintExtractor(const AudioConfig& config = kDefaultConfig);

    std::vector<Peak> extractPeaks(const std::vector<double>& signal) const;
    std::vector<Fingerprint> generateFingerprints(const std::vector<Peak>& peaks) const;

    std::vector<Fingerprint> processSignal(const std::vector<float>& signal) const;

    const AudioConfig& config() const { return config_; }

    size_t numFrames(size_t sample_count) const;

private:
    AudioConfig config_;
    FFT fft_;
    std::vector<double> window_;

    void buildHannWindow();
    std::vector<std::vector<double>> computeSpectrogram(const std::vector<double>& signal) const;
    std::vector<Peak> findPeaks(const std::vector<std::vector<double>>& spectrogram) const;
};

uint32_t hashPair(uint32_t f1, uint32_t f2, uint32_t dt);

} // namespace audioproc

#endif
