#ifndef FLUID_PARAMS_H
#define FLUID_PARAMS_H

#include <vector>
#include <array>

struct FluidParams {
    int gridSize;
    double viscosity;
    double baseDensity;
    double damping;
    double timeStep;
    
    std::vector<double> densityGrid;
    std::vector<double> velocityX;
    std::vector<double> velocityY;
    std::vector<double> velocityZ;
    std::vector<double> viscosityField;
    
    struct Boundaries {
        double min[3];
        double max[3];
    } boundaries;
};

#endif
