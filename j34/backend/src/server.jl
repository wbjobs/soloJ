using HTTP
using JSON3
using StructTypes
using Dates
using Random

include("AcousticFEM.jl")
using .AcousticFEM

struct ComputeRequest
    params::Dict{String, Float64}
    compute_band_structure::Bool
    compute_transmission_loss::Bool
end

struct ComputeResponse
    success::Bool
    message::String
    band_structure::Union{Nothing, Dict}
    transmission_loss::Union{Nothing, Dict}
    job_id::String
end

StructTypes.StructType(::Type{ComputeRequest}) = StructTypes.Struct()
StructTypes.StructType(::Type{ComputeResponse}) = StructTypes.Struct()

const JOB_RESULTS = Dict{String, Dict}()
const ACTIVE_JOBS = Set{String}()
const JOB_LOCK = ReentrantLock()

function generate_job_id()
    return string(now(), "-", randstring(8))
end

function params_dict_to_struct(params_dict::Dict{String, Float64})
    return UnitCellParams(
        lattice_constant=get(params_dict, "lattice_constant", 0.05),
        cylinder_radius=get(params_dict, "cylinder_radius", 0.015),
        cylinder_height=get(params_dict, "cylinder_height", 0.03),
        matrix_density=get(params_dict, "matrix_density", 1200.0),
        matrix_speed_of_sound=get(params_dict, "matrix_speed_of_sound", 2500.0),
        scatterer_density=get(params_dict, "scatterer_density", 7800.0),
        scatterer_speed_of_sound=get(params_dict, "scatterer_speed_of_sound", 5000.0),
        filling_fraction=get(params_dict, "filling_fraction", 0.28)
    )
end

function compute_async(job_id::String, request::ComputeRequest)
    try
        params = params_dict_to_struct(request.params)
        
        result = Dict(
            "job_id" => job_id,
            "status" => "completed",
            "timestamp" => string(now()),
            "parameters" => request.params
        )
        
        if request.compute_band_structure
            k_path, eigenvalues = compute_band_structure(params)
            result["band_structure"] = Dict(
                "k_path" => [collect(k) for k in k_path],
                "eigenvalues" => eigenvalues
            )
        end
        
        if request.compute_transmission_loss
            frequencies, tl = compute_transmission_loss(params)
            result["transmission_loss"] = Dict(
                "frequencies" => frequencies,
                "values" => tl
            )
        end
        
        lock(JOB_LOCK) do
            JOB_RESULTS[job_id] = result
            delete!(ACTIVE_JOBS, job_id)
        end
        
    catch e
        lock(JOB_LOCK) do
            JOB_RESULTS[job_id] = Dict(
                "job_id" => job_id,
                "status" => "failed",
                "error" => string(e)
            )
            delete!(ACTIVE_JOBS, job_id)
        end
    end
end

function handle_compute(req)
    try
        body = JSON3.read(req.body, ComputeRequest)
        job_id = generate_job_id()
        
        lock(JOB_LOCK) do
            push!(ACTIVE_JOBS, job_id)
        end
        
        @async compute_async(job_id, body)
        
        response = ComputeResponse(
            true,
            "Job submitted successfully",
            nothing,
            nothing,
            job_id
        )
        
        return HTTP.Response(202, ["Content-Type" => "application/json"], body=JSON3.write(response))
    catch e
        return HTTP.Response(400, ["Content-Type" => "application/json"],
            body=JSON3.write(Dict("success" => false, "message" => string(e))))
    end
end

function handle_result(req)
    job_id = split(req.target, "/")[end]
    
    lock(JOB_LOCK) do
        if haskey(JOB_RESULTS, job_id)
            return HTTP.Response(200, ["Content-Type" => "application/json"],
                body=JSON3.write(JOB_RESULTS[job_id]))
        elseif job_id in ACTIVE_JOBS
            return HTTP.Response(200, ["Content-Type" => "application/json"],
                body=JSON3.write(Dict("status" => "processing", "job_id" => job_id)))
        else
            return HTTP.Response(404, ["Content-Type" => "application/json"],
                body=JSON3.write(Dict("status" => "not_found", "job_id" => job_id)))
        end
    end
end

function handle_health(req)
    return HTTP.Response(200, ["Content-Type" => "application/json"],
        body=JSON3.write(Dict("status" => "healthy", "timestamp" => string(now()))))
end

const ROUTER = HTTP.Router()

ROUTER["POST", "/api/compute"] = handle_compute
ROUTER["GET", "/api/result/*"] = handle_result
ROUTER["GET", "/health"] = handle_health

println("Starting Julia FEM server on port 8081...")
HTTP.serve(ROUTER, "0.0.0.0", 8081)
