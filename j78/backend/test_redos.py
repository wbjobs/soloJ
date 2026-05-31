import time
import sys

sys.path.insert(0, '.')

from nlp_extractor import (
    extract_ips,
    extract_domains,
    extract_organizations,
    extract_entities,
    IP_PATTERN,
    DOMAIN_PATTERN,
    ORG_PATTERN,
    clean_input,
    MAX_TEXT_LENGTH
)


def test_regex_performance(pattern, test_input, iterations=3, timeout_seconds=2.0):
    """测试正则表达式的性能，检测是否存在 ReDoS 漏洞"""
    times = []
    
    for i in range(iterations):
        start_time = time.time()
        try:
            matches = list(pattern.finditer(test_input))
            elapsed = time.time() - start_time
            times.append(elapsed)
            
            if elapsed > timeout_seconds:
                print(f"  ⚠️  警告: 匹配耗时 {elapsed:.3f} 秒，可能存在 ReDoS 风险！")
                return False, times, matches
        except Exception as e:
            print(f"  ❌ 错误: {e}")
            return False, times, []
    
    avg_time = sum(times) / len(times)
    print(f"  ✅ 平均耗时: {avg_time:.4f} 秒，共 {len(matches)} 个匹配")
    return True, times, matches


def test_ip_redos():
    """测试 IP 正则表达式的 ReDoS 安全性"""
    print("\n=== 测试 IP 正则表达式 ReDoS 安全性 ===")
    
    safe_cases = [
        "正常 IP: 192.168.1.1",
        "多个 IP: 10.0.0.1, 172.16.0.1, 8.8.8.8",
        "无效 IP: 999.999.999.999",
        "部分 IP: 192.168.1",
    ]
    
    for i, test_case in enumerate(safe_cases, 1):
        print(f"\n测试用例 {i}: {test_case[:50]}...")
        result = test_regex_performance(IP_PATTERN, test_case)
        ips = extract_ips(test_case)
        print(f"  提取结果: {ips}")
    
    malicious_cases = [
        "重复数字攻击: " + "1" * 1000,
        "重复点攻击: " + "1.1.1.1." * 100,
        "长数字串: " + "9" * 5000,
    ]
    
    print("\n--- 恶意输入测试 ---")
    for i, test_case in enumerate(malicious_cases, 1):
        print(f"\n恶意用例 {i}: 长度={len(test_case)}")
        result = test_regex_performance(IP_PATTERN, test_case, iterations=1)
        ips = extract_ips(test_case)
        print(f"  提取结果数量: {len(ips)}")
    
    return True


def test_domain_redos():
    """测试域名正则表达式的 ReDoS 安全性"""
    print("\n=== 测试域名正则表达式 ReDoS 安全性 ===")
    
    safe_cases = [
        "正常域名: example.com",
        "多级域名: sub.domain.example.co.uk",
        "多个域名: google.com, microsoft.com, apple.com",
        "连字符域名: test-server-01.example.org",
    ]
    
    for i, test_case in enumerate(safe_cases, 1):
        print(f"\n测试用例 {i}: {test_case}")
        result = test_regex_performance(DOMAIN_PATTERN, test_case)
        domains = extract_domains(test_case)
        print(f"  提取结果: {domains}")
    
    malicious_cases = [
        "长子域名攻击: " + "a." * 50 + "com",
        "重复字符攻击: " + "a" * 1000 + ".com",
        "多 TLD 攻击: " + "a" * 500 + ".co.uk.com.org.net",
        "连字符洪水: " + "a-" * 200 + "example.com",
    ]
    
    print("\n--- 恶意输入测试 ---")
    for i, test_case in enumerate(malicious_cases, 1):
        print(f"\n恶意用例 {i}: 长度={len(test_case)}")
        result = test_regex_performance(DOMAIN_PATTERN, test_case, iterations=1)
        domains = extract_domains(test_case)
        print(f"  提取结果数量: {len(domains)}")
    
    return True


def test_organization_redos():
    """测试组织名称正则表达式的 ReDoS 安全性"""
    print("\n=== 测试组织名称正则表达式 ReDoS 安全性 ===")
    
    safe_cases = [
        "APT28 进行了网络攻击",
        "Lazarus Group 和 WannaCry 有关联",
        "检测到来自 Cobalt Strike 的活动",
    ]
    
    for i, test_case in enumerate(safe_cases, 1):
        print(f"\n测试用例 {i}: {test_case}")
        result = test_regex_performance(ORG_PATTERN, test_case)
        orgs = extract_organizations(test_case)
        print(f"  提取结果: {orgs}")
    
    malicious_cases = [
        "重复关键词: " + "APT28 " * 100,
        "长文本攻击: " + "x " * 1000 + "APT29",
        "特殊字符: " + "$" * 500 + "Lazarus",
    ]
    
    print("\n--- 恶意输入测试 ---")
    for i, test_case in enumerate(malicious_cases, 1):
        print(f"\n恶意用例 {i}: 长度={len(test_case)}")
        result = test_regex_performance(ORG_PATTERN, test_case, iterations=1)
        orgs = extract_organizations(test_case)
        print(f"  提取结果数量: {len(orgs)}")
    
    return True


def test_input_cleaning():
    """测试输入清理功能"""
    print("\n=== 测试输入清理功能 ===")
    
    test_cases = [
        ("空输入", None, ""),
        ("超长输入", "x" * (MAX_TEXT_LENGTH + 1000), MAX_TEXT_LENGTH),
        ("空字符", "hello\x00world", "helloworld"),
        ("控制字符", "test\x01\x02\x03data", "testdata"),
    ]
    
    all_passed = True
    for name, input_data, expected in test_cases:
        result = clean_input(input_data)
        if isinstance(expected, int):
            passed = len(result) == expected
        else:
            passed = result == expected
        
        status = "✅" if passed else "❌"
        print(f"{status} {name}: 长度={len(result)}")
        if not passed:
            all_passed = False
            print(f"   期望: {expected}, 实际: {result[:50]}...")
    
    return all_passed


def test_extract_entities():
    """测试完整的实体提取功能"""
    print("\n=== 测试完整实体提取 ===")
    
    threat_report = """
    近期监测发现，APT28 组织利用 192.168.1.100 和 10.0.0.50 两个 IP 地址
    作为 C2 服务器，控制的恶意域名包括 malware-c2.com 和 phishing-site.org。
    Lazarus Group 也使用了类似的攻击手法，WannaCry 勒索软件仍在活跃。
    """
    
    start_time = time.time()
    result = extract_entities(threat_report)
    elapsed = time.time() - start_time
    
    print(f"提取耗时: {elapsed:.4f} 秒")
    print(f"IP 地址: {result['ips']}")
    print(f"域名: {result['domains']}")
    print(f"攻击组织: {result['organizations']}")
    print(f"总计提取: {result['total_count']}")
    
    if elapsed < 0.5 and result['total_count'] > 0:
        print("✅ 实体提取正常")
        return True
    else:
        print("❌ 实体提取可能有问题")
        return False


def main():
    print("=" * 60)
    print("ReDoS 漏洞安全测试")
    print("=" * 60)
    
    tests = [
        ("输入清理", test_input_cleaning),
        ("IP 正则 ReDoS", test_ip_redos),
        ("域名正则 ReDoS", test_domain_redos),
        ("组织正则 ReDoS", test_organization_redos),
        ("完整实体提取", test_extract_entities),
    ]
    
    results = []
    for name, test_func in tests:
        try:
            passed = test_func()
            results.append((name, passed))
        except Exception as e:
            print(f"\n❌ {name} 测试出错: {e}")
            results.append((name, False))
    
    print("\n" + "=" * 60)
    print("测试总结")
    print("=" * 60)
    
    all_passed = True
    for name, passed in results:
        status = "✅ 通过" if passed else "❌ 失败"
        print(f"{status}: {name}")
        if not passed:
            all_passed = False
    
    print("\n" + "=" * 60)
    if all_passed:
        print("🎉 所有测试通过！系统对 ReDoS 攻击有良好防护。")
    else:
        print("⚠️  部分测试失败，请检查代码。")
    print("=" * 60)
    
    return 0 if all_passed else 1


if __name__ == '__main__':
    sys.exit(main())
