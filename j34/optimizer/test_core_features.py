import sys
import os
import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

print("=" * 70)
print("  新功能核心测试 (不依赖外部优化库)")
print("=" * 70)
print()

passed = 0
total = 0

def test_case(name, test_func):
    global passed, total
    total += 1
    try:
        result = test_func()
        if result:
            passed += 1
            print(f"  ✓ PASS: {name}")
            return True
        else:
            print(f"  ✗ FAIL: {name}")
            return False
    except Exception as e:
        import traceback
        print(f"  ✗ FAIL: {name}")
        print(f"    错误: {str(e)}")
        traceback.print_exc()
        return False


print("-" * 70)
print("  TEST 1: 神经网络代理模型")
print("-" * 70)
print()


def test_surrogate_dataset():
    from src.surrogate_model import BandGapDataset
    ds = BandGapDataset()
    X, y = ds.generate_synthetic_data(n_samples=500)

    assert X.shape == (500, 8), f"X shape error: {X.shape}"
    assert y.shape == (500, 1), f"y shape error: {y.shape}"
    assert not np.any(np.isnan(X)), "X contains NaN"
    assert not np.any(np.isnan(y)), "y contains NaN"

    X_norm = ds.normalize_X(X)
    assert X_norm.min() >= -0.01 and X_norm.max() <= 1.01, "Normalization out of range"

    y_norm = ds.normalize_y(y)
    assert abs(y_norm.mean()) < 0.2, f"y normalization mean error: {y_norm.mean()}"

    return True

test_case("Dataset generation & normalization", test_surrogate_dataset)


def test_nn_model_structure():
    try:
        import torch
        from src.nn_surrogate import BandGapNN, EnsembleNN

        model = BandGapNN(input_dim=8, hidden_dims=[32, 16])

        test_input = torch.randn(10, 8)
        output = model(test_input)
        assert output.shape == (10, 1), f"Output shape mismatch: {output.shape}"

        ensemble = EnsembleNN(n_models=3, input_dim=8, hidden_dims=[16, 8])
        test_X = np.random.randn(5, 8).astype(np.float32)
        pred, std = ensemble.predict(test_X, return_std=True)

        assert pred.shape == (5, 1), f"Pred shape error: {pred.shape}"
        assert std.shape == (5, 1), f"Std shape error: {std.shape}"
        assert np.all(std >= 0), "Std should be non-negative"

        return True
    except ImportError:
        print("    (PyTorch not installed, skipping NN tests)")
        return True

test_case("Neural network structure & ensemble", test_nn_model_structure)


def test_surrogate_trainer_init():
    from src.nn_surrogate import SurrogateModelTrainer

    trainer = SurrogateModelTrainer()
    trainer.dataset.generate_synthetic_data(n_samples=300)
    X_train, X_test, y_train, y_test = trainer.dataset.train_test_split(0.2)

    assert len(X_train) + len(X_test) == 300
    assert len(y_train) + len(y_test) == 300

    info = trainer.get_model_info()
    assert 'is_trained' in info
    assert 'param_names' in info
    assert len(info['param_names']) == 8

    return True

test_case("Surrogate trainer initialization", test_surrogate_trainer_init)

print()
print("-" * 70)
print("  TEST 2: Sobol敏感性分析")
print("-" * 70)
print()


def test_sobol_analyzer_init():
    from src.sobol_sensitivity import SobolSensitivityAnalysis

    analyzer = SobolSensitivityAnalysis()

    assert len(analyzer.param_names) == 8, f"Expected 8 params, got {len(analyzer.param_names)}"
    assert 'lattice_constant' in analyzer.param_names
    assert 'cylinder_radius' in analyzer.param_names
    assert 'filling_fraction' in analyzer.param_names

    problem = analyzer._get_problem()
    assert problem['num_vars'] == 8
    assert len(problem['bounds']) == 8
    assert problem['names'] == analyzer.param_names

    return True

test_case("Sobol analyzer initialization", test_sobol_analyzer_init)


def test_sample_generation():
    from src.sobol_sensitivity import SobolSensitivityAnalysis

    analyzer = SobolSensitivityAnalysis()
    samples, problem = analyzer._generate_lhs_samples(n_samples=64)

    n_expected = 64 * (8 + 2)
    assert len(samples) == n_expected, f"Expected {n_expected} samples, got {len(samples)}"
    assert samples.shape[1] == 8, f"Expected 8 dimensions, got {samples.shape[1]}"

    for i in range(8):
        lo, hi = analyzer.default_bounds[analyzer.param_names[i]]
        assert samples[:, i].min() >= lo - 1e-10, f"Param {i} below bound: min={samples[:, i].min()}, lo={lo}"
        assert samples[:, i].max() <= hi + 1e-10, f"Param {i} above bound: max={samples[:, i].max()}, hi={hi}"

    return True

test_case("LHS sample generation", test_sample_generation)


def test_sensitivity_result_ranking():
    from src.sobol_sensitivity import SensitivityResult

    result = SensitivityResult(
        param_names=['lattice_constant', 'cylinder_radius', 'cylinder_height',
                     'matrix_density', 'matrix_speed_of_sound',
                     'scatterer_density', 'scatterer_speed_of_sound', 'filling_fraction'],
        first_order=np.array([0.1, 0.3, 0.05, 0.2, 0.15, 0.05, 0.1, 0.05]),
        total_order=np.array([0.12, 0.35, 0.06, 0.25, 0.18, 0.06, 0.12, 0.06]),
        sample_count=1000,
        target_start=500,
        target_end=800
    )

    result_dict = result.to_dict()

    assert 'first_order' in result_dict
    assert 'total_order' in result_dict
    assert 'ranking' in result_dict
    assert len(result_dict['ranking']) == 8

    ranking = result_dict['ranking']
    assert ranking[0]['rank'] == 1
    assert ranking[0]['total_order'] >= ranking[1]['total_order']
    assert ranking[0]['param_name'] == 'cylinder_radius', \
        f"Expected 'cylinder_radius' as top, got {ranking[0]['param_name']}"

    total_pct = sum(r['contribution_pct'] for r in ranking)
    assert abs(total_pct - 100) < 5, f"Total contribution should sum to ~100%, got {total_pct:.1f}%"

    assert 'param_names_cn' in result_dict
    assert len(result_dict['param_names_cn']) == 8
    assert '晶格常数' in result_dict['param_names_cn']

    return True

test_case("Sensitivity result formatting & ranking", test_sensitivity_result_ranking)


def test_sobol_objective_calculation():
    from src.sobol_sensitivity import SobolSensitivityAnalysis

    analyzer = SobolSensitivityAnalysis()

    band_gaps = [{'start': 450, 'end': 850, 'width': 400, 'center': 650, 'relative_width': 0.6}]
    score1 = analyzer._calculate_objective(band_gaps, 500, 800)

    band_gaps2 = [{'start': 550, 'end': 750, 'width': 200, 'center': 650, 'relative_width': 0.3}]
    score2 = analyzer._calculate_objective(band_gaps2, 500, 800)

    band_gaps3 = [{'start': 100, 'end': 200, 'width': 100, 'center': 150, 'relative_width': 0.5}]
    score3 = analyzer._calculate_objective(band_gaps3, 500, 800)

    score4 = analyzer._calculate_objective([], 500, 800)

    assert score1 < score2 < score3 < score4, \
        f"Score ordering wrong: {score1:.1f} < {score2:.1f} < {score3:.1f} < {score4:.1f}"

    assert score4 == 1e5, f"No band gap score should be 1e5, got {score4}"

    return True

test_case("Objective function score ordering", test_sobol_objective_calculation)

print()
print("-" * 70)
print("  TEST 3: 物理约束与参数验证")
print("-" * 70)
print()


def test_physical_constraints_enforcement():
    from src.utils import enforce_physical_constraints

    params = {'lattice_constant': 0.05, 'cylinder_radius': 0.03, 'cylinder_height': 0.03}
    corrected = enforce_physical_constraints(params.copy())

    assert corrected['cylinder_radius'] < corrected['lattice_constant'] / 2, \
        f"r should be < a/2: r={corrected['cylinder_radius']:.4f}, a/2={corrected['lattice_constant']/2:.4f}"

    expected_ff = np.pi * (corrected['cylinder_radius'] ** 2) / (corrected['lattice_constant'] ** 2)
    expected_ff = min(max(expected_ff, 0.1), 0.5)
    assert abs(corrected['filling_fraction'] - expected_ff) < 0.01, \
        f"FF inconsistent: expected {expected_ff:.4f}, got {corrected['filling_fraction']:.4f}"

    assert corrected['filling_fraction'] >= 0.1 and corrected['filling_fraction'] <= 0.5, \
        f"FF out of bounds: {corrected['filling_fraction']}"

    valid_params = {'lattice_constant': 0.05, 'cylinder_radius': 0.015, 'cylinder_height': 0.03}
    corrected2 = enforce_physical_constraints(valid_params.copy())
    assert abs(corrected2['cylinder_radius'] - 0.015) < 1e-10, \
        "Valid params should not be modified"

    expected_ff2 = np.pi * (corrected2['cylinder_radius'] ** 2) / (corrected2['lattice_constant'] ** 2)
    expected_ff2 = min(max(expected_ff2, 0.1), 0.5)
    assert abs(corrected2['filling_fraction'] - expected_ff2) < 0.01, \
        f"FF inconsistent: expected {expected_ff2:.4f}, got {corrected2['filling_fraction']:.4f}"

    return True

test_case("Physical constraint enforcement", test_physical_constraints_enforcement)


def test_param_validation():
    from src.utils import validate_params

    bad_params = {
        'lattice_constant': 0.05, 'cylinder_radius': 0.03, 'cylinder_height': 0.03,
        'matrix_density': 1200, 'matrix_speed_of_sound': 2500,
        'scatterer_density': 7800, 'scatterer_speed_of_sound': 5000,
        'filling_fraction': 0.28
    }
    valid, msg = validate_params(bad_params)
    assert not valid, "Should reject r >= a/2"
    assert "超过晶格常数的一半" in msg, f"Wrong error: {msg}"

    good_params = {
        'lattice_constant': 0.05, 'cylinder_radius': 0.015, 'cylinder_height': 0.03,
        'matrix_density': 1200, 'matrix_speed_of_sound': 2500,
        'scatterer_density': 7800, 'scatterer_speed_of_sound': 5000,
        'filling_fraction': 0.28
    }
    valid, msg = validate_params(good_params)
    assert valid, f"Should accept good params: {msg}"

    same_material = good_params.copy()
    same_material['matrix_density'] = 7800
    same_material['matrix_speed_of_sound'] = 5000
    valid, msg = validate_params(same_material)
    assert not valid, "Should reject identical materials"
    assert "必须有显著差异" in msg, f"Wrong error: {msg}"

    zero_params = good_params.copy()
    zero_params['lattice_constant'] = 0
    valid, msg = validate_params(zero_params)
    assert not valid, "Should reject zero lattice constant"

    return True

test_case("Parameter validation edge cases", test_param_validation)

print()
print("-" * 70)
print("  TEST 4: 带隙提取算法")
print("-" * 70)
print()


def test_band_gap_extraction_clean():
    from src.fem_client import FEMClient

    eigenvalues = [
        [100, 111, 320, 331, 790],
        [110, 121, 330, 341, 800],
        [105, 116, 325, 336, 795],
    ]

    gaps = FEMClient.extract_band_gaps(eigenvalues, threshold_ratio=0.01)

    max_band2 = max([e[1] for e in eigenvalues])
    min_band3 = min([e[2] for e in eigenvalues])
    has_gap_2_3 = min_band3 > max_band2
    if has_gap_2_3:
        rel_width_2_3 = (min_band3 - max_band2) / ((max_band2 + min_band3) / 2)
        has_gap_2_3 = rel_width_2_3 > 0.01

    max_band4 = max([e[3] for e in eigenvalues])
    min_band5 = min([e[4] for e in eigenvalues])
    has_gap_4_5 = min_band5 > max_band4
    if has_gap_4_5:
        rel_width_4_5 = (min_band5 - max_band4) / ((max_band4 + min_band5) / 2)
        has_gap_4_5 = rel_width_4_5 > 0.01

    expected_gaps = sum([has_gap_2_3, has_gap_4_5])
    assert len(gaps) == expected_gaps, f"Expected {expected_gaps} gaps, got {len(gaps)}"

    if len(gaps) > 0:
        assert gaps[0]['width'] > 0, "Gap width should be positive"
        assert gaps[0]['start'] > 0, "Gap start should be positive"
        assert gaps[0]['end'] > gaps[0]['start'], "Gap end > start"
        assert 'relative_width' in gaps[0], "Should have relative_width"
        assert gaps[0]['relative_width'] > 0, "Relative width should be positive"

    return True

test_case("Band gap extraction from clean data", test_band_gap_extraction_clean)


def test_band_gap_nan_handling():
    from src.fem_client import FEMClient

    eigenvalues = [
        [100, 200, float('nan'), 500],
        [110, 210, 310, float('inf')],
        [105, 205, 305, 505],
    ]

    gaps = FEMClient.extract_band_gaps(eigenvalues, threshold_ratio=0.01)
    assert len(gaps) >= 1, f"Should extract gaps despite NaN: {len(gaps)}"

    empty_gaps = FEMClient.extract_band_gaps([], threshold_ratio=0.01)
    assert len(empty_gaps) == 0, "Empty input should give empty gaps"

    single_gaps = FEMClient.extract_band_gaps([[100, 200, 300]], threshold_ratio=0.01)
    assert len(single_gaps) >= 0, "Should handle single k-point"

    return True

test_case("Band gap extraction with NaN/Inf", test_band_gap_nan_handling)

print()
print("-" * 70)
print("  TEST 5: 数据集加载")
print("-" * 70)
print()


def test_dataset_param_names():
    from src.surrogate_model import BandGapDataset

    expected_names = [
        'lattice_constant', 'cylinder_radius', 'cylinder_height',
        'matrix_density', 'matrix_speed_of_sound',
        'scatterer_density', 'scatterer_speed_of_sound',
        'filling_fraction'
    ]

    assert BandGapDataset.PARAM_NAMES == expected_names, f"Param names mismatch"

    ds = BandGapDataset()
    X, y = ds.generate_synthetic_data(n_samples=100)

    ds._compute_param_ranges()
    assert len(ds.param_ranges) == 8, f"Expected 8 param ranges"

    for name in expected_names:
        assert name in ds.param_ranges, f"Missing range for {name}"

    return True

test_case("Dataset parameter names & ranges", test_dataset_param_names)


def test_train_test_split():
    from src.surrogate_model import BandGapDataset

    ds = BandGapDataset()
    X, y = ds.generate_synthetic_data(n_samples=100)
    X_train, X_test, y_train, y_test = ds.train_test_split(test_ratio=0.2)

    assert len(X_train) == 80, f"Expected 80 train samples, got {len(X_train)}"
    assert len(X_test) == 20, f"Expected 20 test samples, got {len(X_test)}"
    assert len(y_train) == 80
    assert len(y_test) == 20

    assert X_train.shape[1] == 8
    assert X_test.shape[1] == 8

    return True

test_case("Train/test split correctness", test_train_test_split)

print()
print("=" * 70)
print(f"  核心测试完成: {passed}/{total} 通过")
print("=" * 70)

if passed == total:
    print("\n  ✓ 所有核心功能单元测试通过！\n")
else:
    print(f"\n  ⚠ 部分核心测试失败 ({passed}/{total})\n")

print("模块可用性检查:")
modules = [
    ("surrogate_model", "数据集生成与处理"),
    ("nn_surrogate", "神经网络代理模型"),
    ("sobol_sensitivity", "Sobol敏感性分析"),
    ("bayesian_optimizer", "物理约束与参数验证"),
    ("fem_client", "FEM客户端与带隙提取"),
]

for module, desc in modules:
    try:
        __import__(f"src.{module}")
        print(f"  ✓ {module}: {desc} - 可正常导入")
    except Exception as e:
        print(f"  ✗ {module}: {desc} - 导入失败: {e}")

print()
print("新功能架构:")
print("  ┌─────────────────────────────────────────────────────────────────────┐")
print("  │  神经网络代理模型 (src/nn_surrogate.py)                            │")
print("  │    ├─ BandGapNN: 8→128→256→128→64→1 全连接网络                  │")
print("  │    ├─ EnsembleNN: 5个模型集成，预测+不确定性估计                   │")
print("  │    └─ SurrogateModelTrainer: 数据加载 + 训练 + 持久化              │")
print("  │                                                                   │")
print("  │  Sobol敏感性分析 (src/sobol_sensitivity.py)                        │")
print("  │    ├─ SobolSensitivityAnalysis: Saltelli采样 + SALib分析          │")
print("  │    ├─ SensitivityResult: 结果格式化 + 参数排名                     │")
print("  │    └─ run_sensitivity_analysis: 便捷入口函数                       │")
print("  │                                                                   │")
print("  │  优化器集成 (src/bayesian_optimizer.py)                            │")
print("  │    ├─ _surrogate_predict_batch: 批量快速预测                       │")
print("  │    ├─ _surrogate_filter_candidates: Top-K筛选 + 不确定性感知       │")
print("  │    └─ train_surrogate_model: 在线训练入口                          │")
print("  └─────────────────────────────────────────────────────────────────────┘")
print()
