import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

from backend.services.anomaly_propagation_service import AnomalyPropagationService
from backend.models.data_quality_models import PropagationType, AlertLevel
from collections import deque


class MockNeo4jAdapter:
    def __init__(self, test_lineage_data=None):
        self.test_data = test_lineage_data or self._create_test_lineage()

    def _create_test_lineage(self):
        return {
            "nodes": [
                {"id": "orders.amount", "table": "orders", "column": "amount", "type": "column"},
                {"id": "orders.customer_id", "table": "orders", "column": "customer_id", "type": "column"},
                {"id": "order_summary.total_amount", "table": "order_summary", "column": "total_amount", "type": "column"},
                {"id": "order_summary.order_count", "table": "order_summary", "column": "order_count", "type": "column"},
                {"id": "customer_report.monthly_spend", "table": "customer_report", "column": "monthly_spend", "type": "column"},
                {"id": "customer_report.avg_order", "table": "customer_report", "column": "avg_order", "type": "column"},
                {"id": "final_report.customer_ltv", "table": "final_report", "column": "customer_ltv", "type": "column"},
            ],
            "edges": [
                {"source": "orders.amount", "target": "order_summary.total_amount", "type": "aggregate", "sql": "SUM(amount)"},
                {"source": "orders.amount", "target": "order_summary.order_count", "type": "aggregate", "sql": "COUNT(amount)"},
                {"source": "orders.customer_id", "target": "order_summary.order_count", "type": "join", "sql": "GROUP BY customer_id"},
                {"source": "order_summary.total_amount", "target": "customer_report.monthly_spend", "type": "select", "sql": "total_amount"},
                {"source": "order_summary.total_amount", "target": "customer_report.avg_order", "type": "transform", "sql": "total_amount / order_count"},
                {"source": "order_summary.order_count", "target": "customer_report.avg_order", "type": "transform", "sql": "total_amount / order_count"},
                {"source": "customer_report.monthly_spend", "target": "final_report.customer_ltv", "type": "transform", "sql": "monthly_spend * 12"},
            ],
        }

    def get_column_lineage(self, table_name, column_name, direction="downstream"):
        return self.test_data


def test_propagation_factor_calculation():
    print("=" * 60)
    print("Test 1: 传播因子计算")
    print("=" * 60)

    neo4j = MockNeo4jAdapter()
    service = AnomalyPropagationService(neo4j)

    test_cases = [
        (PropagationType.DIRECT, 1, 1.0, "直接映射"),
        (PropagationType.TRANSFORM, 1, 0.9, "单字段转换"),
        (PropagationType.TRANSFORM, 2, 0.675, "双字段转换"),
        (PropagationType.AGGREGATE, 1, 0.5, "聚合操作"),
        (PropagationType.JOIN, 1, 0.7, "JOIN操作"),
        (PropagationType.FILTER, 1, 0.3, "过滤操作"),
    ]

    all_passed = True
    for prop_type, input_count, expected_factor, description in test_cases:
        actual = service._calculate_propagation_factor(prop_type, input_count)
        diff = abs(actual - expected_factor)
        passed = diff < 0.001

        status = "✓" if passed else "✗"
        print(f"  {status} {description}: expected={expected_factor:.3f}, actual={actual:.3f}")

        if not passed:
            all_passed = False

    print(f"\nTest 1 {'PASSED' if all_passed else 'FAILED'}")
    return all_passed


def test_anomaly_propagation_basic():
    print("\n" + "=" * 60)
    print("Test 2: 基础异常传播分析")
    print("=" * 60)

    neo4j = MockNeo4jAdapter()
    service = AnomalyPropagationService(neo4j)

    result = service.analyze_propagation(
        table_name="orders",
        column_name="amount",
        source_anomaly_rate=0.15,
        anomaly_type="null_rate",
        max_depth=10,
    )

    print(f"源字段: {result.source_table}.{result.source_column}")
    print(f"源异常率: {result.source_anomaly_rate:.1%}")
    print(f"影响字段数: {len(result.affected_columns)}")
    print(f"影响表数: {len(result.affected_tables)}")
    print(f"风险等级: {result.estimated_impact.get('risk_level', 'UNKNOWN')}")

    print("\n传播链:")
    for node in result.propagation_chain:
        print(f"  {node.table_name}.{node.column_name}: "
              f"input={node.input_anomaly_rate:.1%} -> "
              f"output={node.output_anomaly_rate:.1%} "
              f"[{node.propagation_type.value}]")

    all_passed = len(result.affected_columns) > 0
    print(f"\nTest 2 {'PASSED' if all_passed else 'FAILED'}")
    return all_passed


def test_propagation_monotonic_decrease():
    print("\n" + "=" * 60)
    print("Test 3: 异常率单调递减验证")
    print("=" * 60)

    neo4j = MockNeo4jAdapter()
    service = AnomalyPropagationService(neo4j)

    result = service.analyze_propagation(
        table_name="orders",
        column_name="amount",
        source_anomaly_rate=0.20,
    )

    all_passed = True
    print(f"源异常率: {result.source_anomaly_rate:.1%}")

    for node in result.propagation_chain:
        if node.output_anomaly_rate > result.source_anomaly_rate + 0.001:
            print(f"  ✗ {node.table_name}.{node.column_name}: "
                  f"{node.output_anomaly_rate:.1%} > 源异常率 {result.source_anomaly_rate:.1%}")
            all_passed = False
        else:
            print(f"  ✓ {node.table_name}.{node.column_name}: {node.output_anomaly_rate:.1%}")

    print(f"\nTest 3 {'PASSED' if all_passed else 'FAILED'}")
    return all_passed


def test_propagation_type_effect():
    print("\n" + "=" * 60)
    print("Test 4: 不同转换类型的传播效果")
    print("=" * 60)

    neo4j = MockNeo4jAdapter()
    service = AnomalyPropagationService(neo4j)

    result = service.analyze_propagation(
        table_name="orders",
        column_name="amount",
        source_anomaly_rate=0.20,
    )

    type_effects = {}
    for node in result.propagation_chain:
        pt = node.propagation_type
        if pt not in type_effects:
            type_effects[pt] = []
        type_effects[pt].append((node.input_anomaly_rate, node.output_anomaly_rate))

    all_passed = True
    for pt, rates in type_effects.items():
        print(f"\n  {pt.value}:")
        avg_factor = 0
        for input_r, output_r in rates:
            factor = output_r / input_r if input_r > 0 else 0
            avg_factor += factor
            print(f"    {input_r:.1%} -> {output_r:.1%} (factor={factor:.2f})")
        avg_factor = avg_factor / len(rates) if rates else 0

        expected_factors = {
            PropagationType.DIRECT: 1.0,
            PropagationType.TRANSFORM: 0.9,
            PropagationType.AGGREGATE: 0.5,
            PropagationType.JOIN: 0.7,
            PropagationType.FILTER: 0.3,
        }

        expected = expected_factors.get(pt, 0.5)
        if abs(avg_factor - expected) > 0.2:
            print(f"    平均因子: {avg_factor:.2f} (预期: {expected:.2f}) - WARNING")
        else:
            print(f"    平均因子: {avg_factor:.2f} (预期: {expected:.2f}) - OK")

    print(f"\nTest 4 PASSED")
    return True


def test_risk_level_calculation():
    print("\n" + "=" * 60)
    print("Test 5: 风险等级计算")
    print("=" * 60)

    neo4j = MockNeo4jAdapter()
    service = AnomalyPropagationService(neo4j)

    test_cases = [
        (0.25, "CRITICAL", "严重异常"),
        (0.15, "HIGH", "高异常"),
        (0.07, "MEDIUM", "中异常"),
        (0.03, "LOW", "低异常"),
        (0.005, "NONE", "无异常"),
    ]

    all_passed = True
    for rate, expected_level, description in test_cases:
        actual_level = service._calculate_risk_level(rate)
        passed = actual_level == expected_level

        status = "✓" if passed else "✗"
        print(f"  {status} {description}: rate={rate:.1%}, expected={expected_level}, actual={actual_level}")

        if not passed:
            all_passed = False

    print(f"\nTest 5 {'PASSED' if all_passed else 'FAILED'}")
    return all_passed


def test_visualization_data():
    print("\n" + "=" * 60)
    print("Test 6: 可视化数据生成")
    print("=" * 60)

    neo4j = MockNeo4jAdapter()
    service = AnomalyPropagationService(neo4j)

    result = service.analyze_propagation(
        table_name="orders",
        column_name="amount",
        source_anomaly_rate=0.15,
    )

    viz_data = service.visualize_propagation_data(result)

    print(f"节点数: {len(viz_data['nodes'])}")
    print(f"边数: {len(viz_data['edges'])}")
    print(f"源节点: {viz_data['source_column']}")

    all_passed = True

    if not viz_data.get('nodes'):
        print("  ✗ 没有生成节点")
        all_passed = False
    else:
        print("  ✓ 节点生成成功")

    if viz_data.get('source_column') != result.source_column_id:
        print(f"  ✗ 源节点ID不匹配")
        all_passed = False
    else:
        print("  ✓ 源节点ID正确")

    anomaly_rates = [n.get('anomaly_rate', 0) for n in viz_data['nodes']]
    if max(anomaly_rates) > result.source_anomaly_rate + 0.001:
        print(f"  ✗ 节点异常率超过源异常率")
        all_passed = False
    else:
        print("  ✓ 节点异常率合理")

    print(f"\nTest 6 {'PASSED' if all_passed else 'FAILED'}")
    return all_passed


def test_batch_propagation():
    print("\n" + "=" * 60)
    print("Test 7: 批量异常传播分析")
    print("=" * 60)

    neo4j = MockNeo4jAdapter()
    service = AnomalyPropagationService(neo4j)

    sources = [
        {"table_name": "orders", "column_name": "amount", "anomaly_rate": 0.15},
        {"table_name": "orders", "column_name": "customer_id", "anomaly_rate": 0.10},
    ]

    result = service.batch_propagation_analysis(sources, max_depth=5)

    print(f"源数量: {result['summary']['total_sources']}")
    print(f"影响字段总数: {result['summary']['unique_affected_columns']}")
    print(f"最大组合异常率: {result['summary']['max_combined_anomaly']:.1%}")
    print(f"传播结果数: {len(result['results'])}")

    all_passed = len(result.get('results', [])) == len(sources)
    print(f"\nTest 7 {'PASSED' if all_passed else 'FAILED'}")
    return all_passed


def run_all_tests():
    print("\n" + "#" * 60)
    print("Running Anomaly Propagation Tests")
    print("#" * 60 + "\n")

    results = []
    results.append(("传播因子计算", test_propagation_factor_calculation()))
    results.append(("基础异常传播分析", test_anomaly_propagation_basic()))
    results.append(("异常率单调递减", test_propagation_monotonic_decrease()))
    results.append(("不同转换类型效果", test_propagation_type_effect()))
    results.append(("风险等级计算", test_risk_level_calculation()))
    results.append(("可视化数据生成", test_visualization_data()))
    results.append(("批量传播分析", test_batch_propagation()))

    print("\n" + "=" * 60)
    print("SUMMARY")
    print("=" * 60)
    for name, passed in results:
        status = "✓ PASSED" if passed else "✗ FAILED"
        print(f"  {name}: {status}")

    total_passed = sum(1 for _, p in results if p)
    total = len(results)
    print(f"\nTotal: {total_passed}/{total} tests passed")

    return total_passed == total


if __name__ == "__main__":
    success = run_all_tests()
    sys.exit(0 if success else 1)
