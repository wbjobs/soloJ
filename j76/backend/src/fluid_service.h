#ifndef FLUID_SERVICE_H
#define FLUID_SERVICE_H

#include "fluid_params.h"
#include <cmath>
#include <random>
#include <algorithm>

class FluidService {
public:
    FluidParams generateParams(int gridSize, double baseViscosity, double baseDensity) {
        FluidParams params;
        params.gridSize = gridSize;
        params.viscosity = baseViscosity;
        params.baseDensity = baseDensity;
        params.damping = 0.995;
        params.timeStep = 0.016;
        
        params.boundaries.min[0] = -10.0;
        params.boundaries.min[1] = -10.0;
        params.boundaries.min[2] = -10.0;
        params.boundaries.max[0] = 10.0;
        params.boundaries.max[1] = 10.0;
        params.boundaries.max[2] = 10.0;
        
        int totalSize = gridSize * gridSize * gridSize;
        params.densityGrid.resize(totalSize);
        params.velocityX.resize(totalSize);
        params.velocityY.resize(totalSize);
        params.velocityZ.resize(totalSize);
        params.viscosityField.resize(totalSize);
        
        generateDensityGrid(params);
        generateVelocityField(params);
        generateViscosityField(params);
        
        return params;
    }

private:
    double noise(int x, int y, int z, int seed = 0) {
        int n = x + y * 57 + z * 343 + seed * 131;
        n = (n << 13) ^ n;
        return 1.0 - ((n * (n * n * 15731 + 789221) + 1376312589) & 0x7fffffff) / 1073741824.0;
    }
    
    double smoothNoise(int x, int y, int z, int seed = 0) {
        double corners = (noise(x-1, y-1, z-1, seed) + noise(x+1, y-1, z-1, seed) +
                         noise(x-1, y+1, z-1, seed) + noise(x+1, y+1, z-1, seed) +
                         noise(x-1, y-1, z+1, seed) + noise(x+1, y-1, z+1, seed) +
                         noise(x-1, y+1, z+1, seed) + noise(x+1, y+1, z+1, seed)) / 32.0;
        double sides = (noise(x-1, y, z, seed) + noise(x+1, y, z, seed) +
                       noise(x, y-1, z, seed) + noise(x, y+1, z, seed) +
                       noise(x, y, z-1, seed) + noise(x, y, z+1, seed)) / 24.0;
        double center = noise(x, y, z, seed) / 8.0;
        return corners + sides + center;
    }
    
    double interpolatedNoise(double x, double y, double z, int seed = 0) {
        int intX = static_cast<int>(floor(x));
        double fracX = x - intX;
        int intY = static_cast<int>(floor(y));
        double fracY = y - intY;
        int intZ = static_cast<int>(floor(z));
        double fracZ = z - intZ;
        
        double v1 = smoothNoise(intX, intY, intZ, seed);
        double v2 = smoothNoise(intX + 1, intY, intZ, seed);
        double v3 = smoothNoise(intX, intY + 1, intZ, seed);
        double v4 = smoothNoise(intX + 1, intY + 1, intZ, seed);
        double v5 = smoothNoise(intX, intY, intZ + 1, seed);
        double v6 = smoothNoise(intX + 1, intY, intZ + 1, seed);
        double v7 = smoothNoise(intX, intY + 1, intZ + 1, seed);
        double v8 = smoothNoise(intX + 1, intY + 1, intZ + 1, seed);
        
        double i1 = lerp(v1, v2, fracX);
        double i2 = lerp(v3, v4, fracX);
        double i3 = lerp(v5, v6, fracX);
        double i4 = lerp(v7, v8, fracX);
        double i5 = lerp(i1, i2, fracY);
        double i6 = lerp(i3, i4, fracY);
        
        return lerp(i5, i6, fracZ);
    }
    
    double lerp(double a, double b, double t) {
        return a + t * (b - a);
    }
    
    double perlinNoise(double x, double y, double z, int octaves = 3) {
        double total = 0.0;
        double frequency = 1.0;
        double amplitude = 1.0;
        double maxValue = 0.0;
        
        for (int i = 0; i < octaves; i++) {
            total += interpolatedNoise(x * frequency, y * frequency, z * frequency, i) * amplitude;
            maxValue += amplitude;
            amplitude *= 0.5;
            frequency *= 2.0;
        }
        
        return total / maxValue;
    }
    
    void generateDensityGrid(FluidParams& params) {
        int n = params.gridSize;
        double scale = 4.0 / n;
        
        for (int k = 0; k < n; k++) {
            for (int j = 0; j < n; j++) {
                for (int i = 0; i < n; i++) {
                    int idx = k * n * n + j * n + i;
                    double x = (i - n / 2.0) * scale;
                    double y = (j - n / 2.0) * scale;
                    double z = (k - n / 2.0) * scale;
                    
                    double noiseVal = perlinNoise(x, y, z, 3);
                    double distFromCenter = sqrt(x*x + y*y + z*z);
                    double falloff = 1.0 - std::min(distFromCenter / 5.0, 1.0);
                    
                    params.densityGrid[idx] = params.baseDensity * (0.8 + 0.4 * noiseVal) * falloff;
                }
            }
        }
    }
    
    void generateVelocityField(FluidParams& params) {
        int n = params.gridSize;
        double scale = 4.0 / n;
        
        for (int k = 0; k < n; k++) {
            for (int j = 0; j < n; j++) {
                for (int i = 0; i < n; i++) {
                    int idx = k * n * n + j * n + i;
                    double x = (i - n / 2.0) * scale;
                    double y = (j - n / 2.0) * scale;
                    double z = (k - n / 2.0) * scale;
                    
                    double r = sqrt(x*x + y*y);
                    double theta = atan2(y, x);
                    double phi = atan2(r, z);
                    
                    double vorticity = 2.0;
                    params.velocityX[idx] = -vorticity * y * exp(-r*r/8.0) + 0.5 * perlinNoise(x*0.3, y*0.3, z*0.3, 1);
                    params.velocityY[idx] = vorticity * x * exp(-r*r/8.0) + 0.5 * perlinNoise(x*0.3, y*0.3, z*0.3 + 100, 2);
                    params.velocityZ[idx] = 0.3 * sin(phi * 2.0) + 0.5 * perlinNoise(x*0.3, y*0.3, z*0.3 + 200, 3);
                }
            }
        }
    }
    
    void generateViscosityField(FluidParams& params) {
        int n = params.gridSize;
        double scale = 4.0 / n;
        
        for (int k = 0; k < n; k++) {
            for (int j = 0; j < n; j++) {
                for (int i = 0; i < n; i++) {
                    int idx = k * n * n + j * n + i;
                    double x = (i - n / 2.0) * scale;
                    double y = (j - n / 2.0) * scale;
                    double z = (k - n / 2.0) * scale;
                    
                    double distFromCenter = sqrt(x*x + y*y + z*z);
                    double centerFactor = 1.0 - 0.5 * std::min(distFromCenter / 6.0, 1.0);
                    
                    params.viscosityField[idx] = params.viscosity * (0.5 + 1.5 * centerFactor);
                }
            }
        }
    }
};

#endif
