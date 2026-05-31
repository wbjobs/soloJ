module AcousticFEM

using Gridap
using Gridap.Geometry
using Gridap.FESpaces
using Gridap.Algebra
using SparseArrays
using LinearAlgebra
using ArnoldiMethod
using HDF5

export UnitCellParams, compute_band_structure, compute_transmission_loss, save_results, validate_params

const MAX_FEM_ITERATIONS = 1000
const FEM_TOLERANCE = 1e-8

struct UnitCellParams
    lattice_constant::Float64
    cylinder_radius::Float64
    cylinder_height::Float64
    matrix_density::Float64
    matrix_speed_of_sound::Float64
    scatterer_density::Float64
    scatterer_speed_of_sound::Float64
    filling_fraction::Float64
end

function UnitCellParams(;
    lattice_constant=0.05,
    cylinder_radius=0.015,
    cylinder_height=0.03,
    matrix_density=1200.0,
    matrix_speed_of_sound=2500.0,
    scatterer_density=7800.0,
    scatterer_speed_of_sound=5000.0,
    filling_fraction=0.28
)
    return UnitCellParams(
        lattice_constant, cylinder_radius, cylinder_height,
        matrix_density, matrix_speed_of_sound,
        scatterer_density, scatterer_speed_of_sound, filling_fraction
    )
end

function validate_params(params::UnitCellParams)::Tuple{Bool, String}
    if params.lattice_constant <= 0
        return false, "晶格常数必须 > 0"
    end
    if params.cylinder_radius <= 0
        return false, "柱体半径必须 > 0"
    end
    if params.cylinder_radius >= params.lattice_constant / 2
        return false, "柱体半径不能超过晶格常数的一半"
    end
    if params.cylinder_height <= 0
        return false, "柱体高度必须 > 0"
    end
    if params.matrix_density <= 0 || params.scatterer_density <= 0
        return false, "密度必须 > 0"
    end
    if params.matrix_speed_of_sound <= 0 || params.scatterer_speed_of_sound <= 0
        return false, "声速必须 > 0"
    end
    if params.filling_fraction <= 0 || params.filling_fraction >= 1
        return false, "填充率必须在 (0, 1) 之间"
    end
    if params.matrix_density == params.scatterer_density && params.matrix_speed_of_sound == params.scatterer_speed_of_sound
        return false, "基体和散射体材料参数不能完全相同"
    end
    return true, "参数有效"
end

function generate_unit_cell_mesh(params::UnitCellParams; resolution=10)
    a = params.lattice_constant
    r = params.cylinder_radius
    h = params.cylinder_height
    
    domain = (0.0, a, 0.0, a, 0.0, h)
    partition = (resolution, resolution, Int(ceil(resolution * h / a)))
    
    model = CartesianDiscreteModel(domain, partition)
    
    labels = get_face_labeling(model)
    add_tag_from_tags!(labels, "dirichlet_boundary", [1, 2, 3, 4, 5, 6])
    
    return model, labels
end

function is_inside_cylinder(point, params::UnitCellParams)
    a = params.lattice_constant
    r = params.cylinder_radius
    cx, cy = a/2, a/2
    x, y, z = point
    return (x - cx)^2 + (y - cy)^2 <= r^2
end

function compute_material_properties(params::UnitCellParams, model)
    ρ_matrix = params.matrix_density
    c_matrix = params.matrix_speed_of_sound
    κ_matrix = ρ_matrix * c_matrix^2
    
    ρ_scatterer = params.scatterer_density
    c_scatterer = params.scatterer_speed_of_sound
    κ_scatterer = ρ_scatterer * c_scatterer^2
    
    grid = get_grid(model)
    cell_coords = get_cell_points(grid)
    
    ρ = CellField(model) do cell
        coords = get_array(mean(get_coordinates(cell)))
        if is_inside_cylinder(coords, params)
            return ρ_scatterer
        else
            return ρ_matrix
        end
    end
    
    κ = CellField(model) do cell
        coords = get_array(mean(get_coordinates(cell)))
        if is_inside_cylinder(coords, params)
            return κ_scatterer
        else
            return κ_matrix
        end
    end
    
    return ρ, κ
end

function compute_band_structure(params::UnitCellParams; num_bands=15, k_path_resolution=15)
    valid, msg = validate_params(params)
    if !valid
        error("参数无效: $msg")
    end

    model, labels = generate_unit_cell_mesh(params)
    ρ, κ = compute_material_properties(params, model)

    order = 1
    reffe = ReferenceFE(lagrangian, Float64, order)
    V = FESpace(model, reffe, conformity=:H1)

    u, v = get_trial_and_test_fe_bases(V)

    Γ = ∫(κ * ∇(u) ⋅ ∇(v)) * get_measure(model)
    M = ∫(ρ * u * v) * get_measure(model)

    K = assemble_matrix(Γ, V, V)
    M_mat = assemble_matrix(M, V, V)

    cond_K = cond(Array(K))
    if cond_K > 1e12
        @warn "刚度矩阵条件数过高 (cond=$cond_K)，可能导致数值不稳定"
    end

    a = params.lattice_constant
    Γ_point = [0.0, 0.0, 0.0]
    X_point = [π/a, 0.0, 0.0]
    M_point = [π/a, π/a, 0.0]

    k_path = generate_k_path(Γ_point, X_point, M_point, Γ_point, k_path_resolution)

    all_eigenvalues = []

    for (ki, k) in enumerate(k_path)
        K_shifted = K + M_mat * (k ⋅ k)

        try
            schur = partialschur(
                K_shifted, M_mat,
                nev=num_bands,
                which=:SM,
                maxiter=MAX_FEM_ITERATIONS,
                tol=FEM_TOLERANCE
            )
            decomp, history = schur

            if !history.converged
                @warn "k点 $ki 特征值求解未收敛 (已达最大迭代次数 $MAX_FEM_ITERATIONS)"
                if length(all_eigenvalues) > 0
                    push!(all_eigenvalues, last(all_eigenvalues))
                else
                    push!(all_eigenvalues, fill(NaN, num_bands))
                end
                continue
            end

            λs, _ = partialeigen(decomp)
            λs_real = real(λs)
            λs_real[λs_real .< 0] .= 0.0

            if any(isnan, λs_real) || any(isinf, λs_real)
                @warn "k点 $ki 包含NaN/Inf特征值，使用前一k点结果"
                if length(all_eigenvalues) > 0
                    push!(all_eigenvalues, last(all_eigenvalues))
                else
                    push!(all_eigenvalues, fill(0.0, num_bands))
                end
                continue
            end

            frequencies = sqrt.(λs_real) / (2π)
            push!(all_eigenvalues, frequencies)

        catch e
            @warn "k点 $ki 求解异常: $(sprint(showerror, e))"
            if length(all_eigenvalues) > 0
                push!(all_eigenvalues, last(all_eigenvalues))
            else
                push!(all_eigenvalues, fill(0.0, num_bands))
            end
            continue
        end
    end

    if isempty(all_eigenvalues)
        error("所有k点求解均失败")
    end

    return k_path, all_eigenvalues
end

function generate_k_path(points..., resolution)
    path = []
    for i in 1:length(points)-1
        start_p = points[i]
        end_p = points[i+1]
        for t in range(0, 1, length=resolution)
            push!(path, start_p + t * (end_p - start_p))
        end
    end
    return path
end

function compute_transmission_loss(params::UnitCellParams; frequencies=range(100, 2000, length=40))
    valid, msg = validate_params(params)
    if !valid
        error("参数无效: $msg")
    end

    model, labels = generate_unit_cell_mesh(params, resolution=8)
    ρ, κ = compute_material_properties(params, model)

    order = 1
    reffe = ReferenceFE(lagrangian, Float64, order)
    V = FESpace(model, reffe, conformity=:H1, dirichlet_tags="dirichlet_boundary")
    U = TrialFESpace(V, 0.0)

    u, v = get_trial_and_test_fe_bases(U)

    transmission_loss = []
    max_retries = 3

    for (fi, f) in enumerate(frequencies)
        ω = 2π * f

        retries = 0
        success = false
        tl_val = 0.0

        while retries < max_retries && !success
            try
                Γ = ∫(κ * ∇(u) ⋅ ∇(v) - ω^2 * ρ * u * v) * get_measure(model)
                F = ∫(v * 1.0) * get_measure(model)

                K = assemble_matrix(Γ, U, V)
                F_vec = assemble_vector(F, V)

                p = K \ F_vec

                if any(isnan, p) || any(isinf, p)
                    @warn "频率 $fi ($(round(f, digits=1))Hz) 解包含NaN/Inf，重试 ($retries/$max_retries)"
                    retries += 1
                    continue
                end

                tl_val = 20 * log10(norm(p) / 1e-6)
                tl_val = max(tl_val, 0.0)
                tl_val = min(tl_val, 200.0)
                success = true

            catch e
                @warn "频率 $fi ($(round(f, digits=1))Hz) 求解异常: $(sprint(showerror, e))，重试 ($retries/$max_retries)"
                retries += 1
                sleep(0.01)
            end
        end

        if !success
            @warn "频率 $fi ($(round(f, digits=1))Hz) 求解失败，使用默认值"
            tl_val = 0.0
        end

        push!(transmission_loss, tl_val)
    end

    return collect(frequencies), transmission_loss
end

function save_results(params::UnitCellParams, k_path, eigenvalues, frequencies, tl, filename)
    h5open(filename, "w") do file
        group = create_group(file, "parameters")
        group["lattice_constant"] = params.lattice_constant
        group["cylinder_radius"] = params.cylinder_radius
        group["cylinder_height"] = params.cylinder_height
        group["matrix_density"] = params.matrix_density
        group["matrix_speed_of_sound"] = params.matrix_speed_of_sound
        group["scatterer_density"] = params.scatterer_density
        group["scatterer_speed_of_sound"] = params.scatterer_speed_of_sound
        group["filling_fraction"] = params.filling_fraction
        
        bs_group = create_group(file, "band_structure")
        bs_group["k_path"] = hcat(k_path...)'
        bs_group["eigenvalues"] = hcat(eigenvalues...)'
        
        tl_group = create_group(file, "transmission_loss")
        tl_group["frequencies"] = collect(frequencies)
        tl_group["transmission_loss"] = tl
    end
end

end
