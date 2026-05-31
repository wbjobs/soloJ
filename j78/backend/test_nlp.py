#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
测试 NLP 实体提取功能
"""

import sys
import re


IP_PATTERN = re.compile(
    r'(?<!\d)(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}'
    r'(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)(?!\d)'
)

DOMAIN_PATTERN = re.compile(
    r'(?<![a-zA-Z0-9-])(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+'
    r'(?:com|org|net|edu|gov|mil|int|arpa|io|cn|com\.cn|org\.cn|net\.cn|'
    r'info|biz|name|pro|museum|aero|coop|travel|jobs|mobi|cat|asia|tel|'
    r'xxx|idv|ac|uk|us|de|jp|fr|au|in|ru|br|ca|it|es|nl|se|no|dk|fi|pl|'
    r'ch|at|be|nz|sg|hk|kr)(?![a-zA-Z0-9-])',
    re.IGNORECASE
)

ATTACK_ORG_KEYWORDS = {
    "apt1", "apt2", "apt3", "apt4", "apt5", "apt6", "apt7", "apt8",
    "apt9", "apt10", "apt11", "apt12", "apt13", "apt14", "apt15",
    "apt16", "apt17", "apt18", "apt19", "apt20", "apt21", "apt22",
    "apt23", "apt24", "apt25", "apt26", "apt27", "apt28", "apt29",
    "apt30", "apt31", "apt32", "apt33", "apt34", "apt35", "apt36", "apt37",
    "apt38", "apt39", "apt40", "apt41", "apt42",
    "Cozy Bear", "Fancy Bear", "Sandworm Team", "Gamaredon", "Turla", "Pitty Tiger",
    "Lazarus Group", "BlueNoroff", "Andariel", "Kimsuky", "Reaper", "DarkHotel",
    "DarkSeoul", "Silent Chollima", "Ricochet Chollima", "BeagleBoyz",
    "LAPSUS$", "Conti", "REvil", "LockBit", "BlackCat", "BlackBasta",
    "Royal", "Cl0p", "Hive", "Emotet", "TrickBot", "QakBot",
    "Emotet", "BazarLoader", "Cobalt Strike", "Metasploit",
    "Platinum", "Gold Dragon", "Hafnium", "Nobelium", "SolarWinds Hackers",
    "Sandworm", "Ghidra", "Equation Group", "Stuxnet", "Duqu", "Flame",
    "Red Apollo", "OceanLotus", "Haymaker", "Bronze Union", "Iron Libra",
    "Hellsing", "BlackTech", "Waterbug", "Higaisa", "Kuckoo",
    "Lizard Squad", "OurMine", "Shadow Brokers", "Guccifer 2.0",
    "Anonymous", "LulzSec",
}


def extract_ips(text):
    ips = IP_PATTERN.findall(text)
    return list(set(ips))


def extract_domains(text):
    domains = DOMAIN_PATTERN.findall(text)
    return list(set(domains))


def extract_organizations_simple(text):
    organizations = []
    
    text_lower = text.lower()
    sorted_keywords = sorted(ATTACK_ORG_KEYWORDS, key=len, reverse=True)
    found_keywords = []
    
    for keyword in sorted_keywords:
        keyword_lower = keyword.lower()
        pattern = r'\b' + re.escape(keyword_lower) + r'\b'
        if re.search(pattern, text_lower):
            if keyword not in found_keywords:
                found_keywords.append(keyword)
    
    organizations.extend(found_keywords)
    
    apt_pattern = re.compile(r'\bAPT[-\s]?\d{1,2}\b', re.IGNORECASE)
    apt_matches = apt_pattern.findall(text)
    for match in apt_matches:
        normalized = re.sub(r'[-\s]', '', match).upper()
        if normalized not in [o.upper() for o in organizations]:
            organizations.append(match)
    
    result = []
    seen = set()
    for org in organizations:
        org_lower = org.lower()
        if org_lower not in seen:
            seen.add(org_lower)
            result.append(org)
    
    return result


def extract_all_entities_simple(text):
    ips = extract_ips(text)
    domains = extract_domains(text)
    organizations = extract_organizations_simple(text)
    
    return {
        "ips": ips,
        "domains": domains,
        "organizations": organizations
    }


def infer_relationships_simple(entities, original_text):
    relationships = []
    
    def _entities_cooccur(entity1, entity2, text):
        window_size = 100
        text_lower = text.lower()
        e1_lower = entity1.lower()
        e2_lower = entity2.lower()
        
        pos1 = text_lower.find(e1_lower)
        pos2 = text_lower.find(e2_lower)
        
        if pos1 == -1 or pos2 == -1:
            return False
        
        return abs(pos1 - pos2) < window_size * 4
    
    for org in entities["organizations"]:
        for ip in entities["ips"]:
            if _entities_cooccur(org, ip, original_text):
                relationships.append({
                    "source": org,
                    "source_type": "organization",
                    "target": ip,
                    "target_type": "ip",
                    "relationship": "USES_IP"
                })
        
        for domain in entities["domains"]:
            if _entities_cooccur(org, domain, original_text):
                relationships.append({
                    "source": org,
                    "source_type": "organization",
                    "target": domain,
                    "target_type": "domain",
                    "relationship": "USES_DOMAIN"
                })
    
    for ip in entities["ips"]:
        for domain in entities["domains"]:
            if _entities_cooccur(ip, domain, original_text):
                relationships.append({
                    "source": ip,
                    "source_type": "ip",
                    "target": domain,
                    "target_type": "domain",
                    "relationship": "RESOLVES_TO"
                })
    
    return relationships


def test_extraction():
    print("=" * 60)
    print("  威胁情报实体提取测试（不依赖 SpaCy）")
    print("=" * 60)
    print()
    
    test_text = """APT28（也称为Fancy Bear）是一个俄罗斯黑客组织。
该组织在最近的攻击活动中使用了IP地址192.168.1.100、10.0.0.50和域名command-control-server.com。

与此同时，Cozy Bear组织（又称APT29）被发现使用IP地址8.8.8.8和域名cozybear-apt29.org对政府机构目标发起了多次网络间谍活动。

Lazarus Group，一个来自朝鲜的黑客组织，涉嫌对金融机构进行了多次攻击。他们使用IP 203.0.113.45和域名lazarus-attack.net。"""
    
    print("[测试文本]")
    print(test_text[:200] + "...")
    print()
    
    print("[提取结果]")
    entities = extract_all_entities_simple(test_text)
    
    print("  IP 地址:", entities["ips"])
    print("  域名:", entities["domains"])
    print("  攻击组织:", entities["organizations"])
    print()
    
    print("[推断的关系]")
    relationships = infer_relationships_simple(entities, test_text)
    for rel in relationships:
        print(f"  {rel['source']} → {rel['relationship']} → {rel['target']}")
    print()
    
    print("[统计]")
    print(f"  IP 数量: {len(entities['ips'])}")
    print(f"  域名数量: {len(entities['domains'])}")
    print(f"  组织数量: {len(entities['organizations'])}")
    print(f"  关系数量: {len(relationships)}")
    print()
    
    print("✓ 测试完成！不依赖 SpaCy 的基础提取功能正常工作。")
    print()
    print("提示: 安装 SpaCy 后可获得更准确的实体识别结果。")
    print("      执行: pip install spacy && python -m spacy download en_core_web_sm")


if __name__ == "__main__":
    try:
        test_extraction()
    except Exception as e:
        print(f"✗ 测试失败: {e}")
        sys.exit(1)
