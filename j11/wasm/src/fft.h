#ifndef AUDIO_FINGERPRINT_FFT_H
#define AUDIO_FINGERPRINT_FFT_H

#include <complex>
#include <vector>
#include <cmath>

namespace audioproc {

using Complex = std::complex<double>;

class FFT {
public:
    FFT(size_t size);

    void forward(std::vector<Complex>& data) const;
    void inverse(std::vector<Complex>& data) const;

    std::vector<double> magnitudeSpectrum(const std::vector<double>& signal) const;
    std::vector<double> magnitudeSpectrumFromComplex(const std::vector<Complex>& data) const;

    size_t size() const { return size_; }

private:
    size_t size_;
    size_t log2_size_;
    std::vector<Complex> twiddle_;
    std::vector<size_t> bit_rev_;

    void buildTwiddleFactors();
    void buildBitReverseTable();
    void transform(std::vector<Complex>& data, bool inverse) const;
};

} // namespace audioproc

#endif
