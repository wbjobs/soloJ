#include "fingerprint.h"
#include <emscripten/bind.h>
#include <emscripten/val.h>
#include <vector>
#include <cstdint>
#include <cstring>

using namespace emscripten;
using namespace audioproc;

class FingerprintEngine {
public:
    FingerprintEngine(int sample_rate, int frame_size, int hop_size)
        : config_(kDefaultConfig) {
        config_.sample_rate = sample_rate;
        config_.frame_size = frame_size;
        config_.hop_size = hop_size;
        extractor_ = std::make_unique<FingerprintExtractor>(config_);
    }

    ~FingerprintEngine() {
        extractor_.reset();
    }

    void destroy() {
        delete this;
    }

    val extractPeaks(const std::vector<float>& signal) {
        std::vector<double> dsig(signal.begin(), signal.end());
        auto peaks = extractor_->extractPeaks(dsig);

        val result = val::array();
        for (size_t i = 0; i < peaks.size(); ++i) {
            val p = val::object();
            p.set("frame", static_cast<int>(peaks[i].frame));
            p.set("bin", static_cast<int>(peaks[i].bin));
            p.set("magnitude", peaks[i].magnitude);
            result.call<void>("push", p);
        }
        return result;
    }

    val generateFingerprints(const std::vector<float>& signal) {
        auto fps = extractor_->processSignal(signal);

        val result = val::array();
        for (size_t i = 0; i < fps.size(); ++i) {
            val f = val::object();
            f.set("hash", static_cast<int>(fps[i].hash));
            f.set("offset", static_cast<int>(fps[i].offset));
            result.call<void>("push", f);
        }
        return result;
    }

    val generateFingerprintArray(const std::vector<float>& signal) {
        auto fps = extractor_->processSignal(signal);

        std::vector<int64_t> flat;
        flat.reserve(fps.size() * 2);
        for (const auto& fp : fps) {
            flat.push_back(static_cast<int64_t>(fp.hash));
            flat.push_back(static_cast<int64_t>(fp.offset));
        }

        val result = val::array();
        for (size_t i = 0; i < flat.size(); ++i) {
            result.call<void>("push", static_cast<int>(flat[i]));
        }
        return result;
    }

    int getFrameSize() const { return config_.frame_size; }
    int getHopSize() const { return config_.hop_size; }
    int getSampleRate() const { return config_.sample_rate; }

    size_t getDynamicMemoryUsed() const {
        return emscripten::val::module_property("HEAP8")["byteLength"].as<size_t>();
    }

private:
    AudioConfig config_;
    std::unique_ptr<FingerprintExtractor> extractor_;
};

EMSCRIPTEN_BINDINGS(audio_fingerprint) {
    class_<FingerprintEngine>("FingerprintEngine")
        .constructor<int, int, int>()
        .function("extractPeaks", &FingerprintEngine::extractPeaks)
        .function("generateFingerprints", &FingerprintEngine::generateFingerprints)
        .function("generateFingerprintArray", &FingerprintEngine::generateFingerprintArray)
        .function("getFrameSize", &FingerprintEngine::getFrameSize)
        .function("getHopSize", &FingerprintEngine::getHopSize)
        .function("getSampleRate", &FingerprintEngine::getSampleRate)
        .function("destroy", &FingerprintEngine::destroy)
        .function("getDynamicMemoryUsed", &FingerprintEngine::getDynamicMemoryUsed);
}
