#include <iostream>
#include <chrono>
#include <thread>
#include <sstream>
#include <iomanip>
#include <cstdio>
#include <fstream>
#include <filesystem>
#include <string>
#include <algorithm>
#include "third_party/httplib.h"
#include "third_party/json.hpp"
#include "fluid_params.h"
#include "fluid_service.h"

using json = nlohmann::json;
using namespace std::chrono;
namespace fs = std::filesystem;

static system_clock::time_point startTime = system_clock::now();

long long getUptimeSeconds() {
    auto now = system_clock::now();
    return duration_cast<seconds>(now - startTime).count();
}

std::string getTimestampString() {
    auto now = system_clock::now();
    auto ms = duration_cast<milliseconds>(now.time_since_epoch());
    auto sec = duration_cast<seconds>(ms);
    auto millis = ms % 1000;
    std::time_t t = system_clock::to_time_t(now);
    std::tm tm = *std::gmtime(&t);
    char buf[64];
    std::snprintf(buf, sizeof(buf), "%04d%02d%02d_%02d%02d%02d_%03lld",
        tm.tm_year + 1900, tm.tm_mon + 1, tm.tm_mday,
        tm.tm_hour, tm.tm_min, tm.tm_sec, millis.count());
    return std::string(buf);
}

void ensureDataDirectory() {
    if (!fs::exists("data")) {
        fs::create_directory("data");
    }
    if (!fs::exists("data/forces")) {
        fs::create_directory("data/forces");
    }
    if (!fs::exists("data/videos")) {
        fs::create_directory("data/videos");
    }
}

void setCorsHeaders(httplib::Response& res) {
    res.set_header("Access-Control-Allow-Origin", "*");
    res.set_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.set_header("Access-Control-Allow-Headers", "Content-Type, Content-Disposition");
    res.set_header("Access-Control-Max-Age", "86400");
}

std::string doubleToPreciseString(double val) {
    char buf[64];
    std::snprintf(buf, sizeof(buf), "%.17g", val);
    return std::string(buf);
}

json vectorToJson(const std::vector<double>& vec) {
    json arr = json::array();
    arr.get_ref<json::array_t&>().reserve(vec.size());
    for (const auto& val : vec) {
        arr.push_back(json::parse(doubleToPreciseString(val)));
    }
    return arr;
}

int main() {
    httplib::Server svr;
    FluidService fluidService;
    
    ensureDataDirectory();
    
    std::cout << "Starting Fluid Simulation Backend Server..." << std::endl;
    
    svr.Options("/api/.*", [](const httplib::Request&, httplib::Response& res) {
        setCorsHeaders(res);
        res.status = 204;
    });
    
    svr.Get("/api/health", [](const httplib::Request&, httplib::Response& res) {
        setCorsHeaders(res);
        json response = {
            {"status", "ok"},
            {"uptime", getUptimeSeconds()}
        };
        res.set_content(response.dump(), "application/json");
    });
    
    svr.Get("/api/fluid/params", [&](const httplib::Request& req, httplib::Response& res) {
        setCorsHeaders(res);
        
        int gridSize = 32;
        double viscosity = 0.0001;
        double density = 1.0;
        
        if (req.has_param("gridSize")) {
            try {
                gridSize = std::stoi(req.get_param_value("gridSize"));
                gridSize = std::max(16, std::min(gridSize, 64));
            } catch (...) {
                gridSize = 32;
            }
        }
        if (req.has_param("viscosity")) {
            try {
                std::string viscStr = req.get_param_value("viscosity");
                size_t idx = 0;
                viscosity = std::stod(viscStr, &idx);
                if (idx != viscStr.size()) {
                    viscosity = 0.0001;
                }
                viscosity = std::max(1e-8, std::min(viscosity, 0.01));
            } catch (...) {
                viscosity = 0.0001;
            }
        }
        if (req.has_param("density")) {
            try {
                std::string densStr = req.get_param_value("density");
                size_t idx = 0;
                density = std::stod(densStr, &idx);
                if (idx != densStr.size()) {
                    density = 1.0;
                }
                density = std::max(0.1, std::min(density, 10.0));
            } catch (...) {
                density = 1.0;
            }
        }
        
        std::cout << "Generating fluid params: gridSize=" << gridSize 
                  << ", viscosity=" << doubleToPreciseString(viscosity)
                  << ", density=" << doubleToPreciseString(density) << std::endl;
        
        auto calcStart = high_resolution_clock::now();
        FluidParams params = fluidService.generateParams(gridSize, viscosity, density);
        auto calcEnd = high_resolution_clock::now();
        auto calcDuration = duration_cast<milliseconds>(calcEnd - calcStart).count();
        
        std::cout << "Calculation completed in " << calcDuration << "ms" << std::endl;
        
        json response;
        response["success"] = true;
        response["data"]["gridSize"] = params.gridSize;
        response["data"]["viscosity"] = json::parse(doubleToPreciseString(params.viscosity));
        response["data"]["baseDensity"] = json::parse(doubleToPreciseString(params.baseDensity));
        response["data"]["damping"] = json::parse(doubleToPreciseString(params.damping));
        response["data"]["timeStep"] = json::parse(doubleToPreciseString(params.timeStep));
        response["data"]["densityGrid"] = vectorToJson(params.densityGrid);
        response["data"]["velocityField"]["x"] = vectorToJson(params.velocityX);
        response["data"]["velocityField"]["y"] = vectorToJson(params.velocityY);
        response["data"]["velocityField"]["z"] = vectorToJson(params.velocityZ);
        response["data"]["viscosityField"] = vectorToJson(params.viscosityField);
        response["data"]["boundaries"]["min"] = {
            json::parse(doubleToPreciseString(params.boundaries.min[0])),
            json::parse(doubleToPreciseString(params.boundaries.min[1])),
            json::parse(doubleToPreciseString(params.boundaries.min[2]))
        };
        response["data"]["boundaries"]["max"] = {
            json::parse(doubleToPreciseString(params.boundaries.max[0])),
            json::parse(doubleToPreciseString(params.boundaries.max[1])),
            json::parse(doubleToPreciseString(params.boundaries.max[2]))
        };
        response["timestamp"] = duration_cast<milliseconds>(system_clock::now().time_since_epoch()).count();
        
        auto jsonStart = high_resolution_clock::now();
        std::string responseStr = response.dump();
        auto jsonEnd = high_resolution_clock::now();
        auto jsonDuration = duration_cast<milliseconds>(jsonEnd - jsonStart).count();
        
        std::cout << "JSON serialization completed in " << jsonDuration 
                  << "ms, size: " << responseStr.size() << " bytes" << std::endl;
        
        res.set_content(responseStr, "application/json");
    });
    
    svr.Post("/api/forces", [](const httplib::Request& req, httplib::Response& res) {
        setCorsHeaders(res);
        
        try {
            json forceData = json::parse(req.body);
            
            std::string sessionId;
            if (forceData.contains("sessionId")) {
                sessionId = forceData["sessionId"].get<std::string>();
            } else {
                sessionId = getTimestampString();
            }
            
            std::string filename = "forces_" + sessionId + ".json";
            std::string filepath = "data/forces/" + filename;
            
            std::ofstream outFile(filepath, std::ios::binary);
            if (outFile.is_open()) {
                outFile << forceData.dump(2);
                outFile.close();
                
                int forceCount = forceData.contains("forceCount") ? forceData["forceCount"].get<int>() : 0;
                
                json response = {
                    {"success", true},
                    {"message", "Force data stored successfully"},
                    {"storedCount", forceCount},
                    {"filename", filename}
                };
                
                std::cout << "[FORCES] Stored " << forceCount << " forces to " << filepath << std::endl;
                res.set_content(response.dump(), "application/json");
            } else {
                res.status = 500;
                json error = {
                    {"success", false},
                    {"message", "Failed to write file"}
                };
                res.set_content(error.dump(), "application/json");
            }
        } catch (const std::exception& e) {
            res.status = 400;
            json error = {
                {"success", false},
                {"message", std::string("Parse error: ") + e.what()}
            };
            res.set_content(error.dump(), "application/json");
        }
    });
    
    svr.Post("/api/video/upload", [](const httplib::Request& req, httplib::Response& res) {
        setCorsHeaders(res);
        
        try {
            std::string filename;
            double duration = 0.0;
            
            if (req.is_multipart_form_data()) {
                for (const auto& [key, file] : req.files) {
                    if (key == "video") {
                        std::string ts = getTimestampString();
                        filename = "video_" + ts + ".webm";
                        std::string filepath = "data/videos/" + filename;
                        
                        std::ofstream outFile(filepath, std::ios::binary);
                        if (outFile.is_open()) {
                            outFile.write(file.content.data(), file.content.size());
                            outFile.close();
                            
                            size_t fileSize = file.content.size();
                            
                            if (req.has_param("duration")) {
                                try {
                                    duration = std::stod(req.get_param_value("duration"));
                                } catch (...) {}
                            }
                            
                            json response = {
                                {"success", true},
                                {"message", "Video uploaded successfully"},
                                {"filename", filename},
                                {"size", fileSize},
                                {"duration", duration}
                            };
                            
                            std::cout << "[VIDEO] Uploaded " << fileSize << " bytes to " << filepath << std::endl;
                            res.set_content(response.dump(), "application/json");
                            return;
                        } else {
                            res.status = 500;
                            json error = {
                                {"success", false},
                                {"message", "Failed to write video file"}
                            };
                            res.set_content(error.dump(), "application/json");
                            return;
                        }
                    }
                }
                
                res.status = 400;
                json error = {
                    {"success", false},
                    {"message", "No video file provided"}
                };
                res.set_content(error.dump(), "application/json");
            } else {
                res.status = 400;
                json error = {
                    {"success", false},
                    {"message", "Request must be multipart/form-data"}
                };
                res.set_content(error.dump(), "application/json");
            }
        } catch (const std::exception& e) {
            res.status = 400;
            json error = {
                {"success", false},
                {"message", std::string("Upload error: ") + e.what()}
            };
            res.set_content(error.dump(), "application/json");
        }
    });
    
    std::cout << "Server starting on port 8080..." << std::endl;
    std::cout << "Endpoints:" << std::endl;
    std::cout << "  GET /api/health" << std::endl;
    std::cout << "  GET /api/fluid/params?gridSize=32&viscosity=0.0001&density=1.0" << std::endl;
    
    svr.listen("0.0.0.0", 8080);
    
    return 0;
}
