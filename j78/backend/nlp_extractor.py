import re
import signal
import sys
from functools import wraps

try:
    import spacy
    SPACY_AVAILABLE = True
except ImportError:
    SPACY_AVAILABLE = False


MAX_TEXT_LENGTH = 102400
MAX_REGEX_TIME = 5.0


class RegexTimeoutError(Exception):
    pass


def timeout_handler(signum, frame):
    raise RegexTimeoutError("正则表达式执行超时")


def with_timeout(timeout_seconds):
    def decorator(func):
        @wraps(func)
        def wrapper(*args, **kwargs):
            if not sys.platform.startswith('win'):
                old_handler = signal.signal(signal.SIGALRM, timeout_handler)
                signal.alarm(int(timeout_seconds))
                try:
                    return func(*args, **kwargs)
                finally:
                    signal.alarm(0)
                    signal.signal(signal.SIGALRM, old_handler)
            else:
                return func(*args, **kwargs)
        return wrapper
    return decorator


def clean_input(text):
    if text is None:
        return ""
    
    if len(text) > MAX_TEXT_LENGTH:
        text = text[:MAX_TEXT_LENGTH]
    
    text = text.replace('\x00', '')
    text = ''.join(char for char in text if ord(char) >= 32 or char in '\n\r\t')
    
    return text


OCTET_PATTERN = r'(?:25[0-5]|2[0-4][0-9]|1[0-9]{2}|[1-9]?[0-9])'
IP_PATTERN = re.compile(
    r'(?<![0-9.])' + OCTET_PATTERN + r'\.' + OCTET_PATTERN + r'\.' + OCTET_PATTERN + r'\.' + OCTET_PATTERN + r'(?![0-9.])'
)

TLD_LIST = (
    'com|org|net|edu|gov|mil|int|arpa|io|cn|com\\.cn|org\\.cn|net\\.cn|'
    'info|biz|name|pro|museum|aero|coop|travel|jobs|mobi|cat|asia|tel|'
    'xxx|idv|ac|uk|us|de|jp|fr|au|in|ru|br|ca|it|es|nl|se|no|dk|fi|pl|'
    'ch|at|be|nz|sg|hk|kr|to|xyz|online|site|tech|store|app|dev|cloud|'
    'ai|co|me|tv|cc|top|club|wiki|live|news|blog|shop|work|agency|'
    'company|group|team|network|systems|solutions|services|software|'
    'digital|marketing|consulting|legal|finance|bank|insurance|'
    'healthcare|medical|pharma|biotech|energy|engineering|'
    'construction|manufacturing|industrial|transport|logistics|'
    'security|defense|onion'
)

DOMAIN_PATTERN = re.compile(
    r'(?<![a-zA-Z0-9-])(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.){1,5}'
    r'(?:' + TLD_LIST + r')\b',
    re.IGNORECASE
)

ATTACK_ORGANIZATIONS = [
    'APT28', 'APT29', 'APT32', 'APT34',
    'Lazarus Group', 'Lazarus',
    'Cozy Bear', 'Fancy Bear', 'Sandworm Team', 'Sandworm',
    'Turla', 'Equation Group', 'Shadow Brokers',
    'OceanLotus', 'Waterbug', 'Higaisa',
    'Golden Dragon', 'Platinum', 'Hafnium', 'Nobelium',
    'Lapsus$', 'Conti', 'REvil', 'BlackCat', 'LockBit',
    'Emotet', 'TrickBot', 'QakBot', 'BazarLoader',
    'Cobalt Strike', 'Metasploit',
    'Anonymous', 'LulzSec', 'Lizard Squad', 'OurMine',
    'WannaCry', 'NotPetya', 'Stuxnet', 'Flame', 'Duqu',
    'Industroyer', 'BlackEnergy', 'CrashOverride',
    'Triton', 'Trisis', 'Havex', 'GreyEnergy',
    'VPNFilter', 'XAgent', 'XLoader', 'Hidden Cobra'
]

ORG_KEYWORDS_SORTED = sorted(ATTACK_ORGANIZATIONS, key=len, reverse=True)

def build_org_regex():
    escaped_keywords = [re.escape(keyword) for keyword in ORG_KEYWORDS_SORTED]
    pattern = r'(?<![a-zA-Z0-9])(?:' + '|'.join(escaped_keywords) + r')(?![a-zA-Z0-9])'
    return re.compile(pattern, re.IGNORECASE)

ORG_PATTERN = build_org_regex()

@with_timeout(MAX_REGEX_TIME)
def safe_regex_search(pattern, text):
    return list(pattern.finditer(text))

def extract_ips(text):
    text = clean_input(text)
    try:
        matches = safe_regex_search(IP_PATTERN, text)
        return [match.group(0) for match in matches]
    except RegexTimeoutError:
        return []

def extract_domains(text):
    text = clean_input(text)
    try:
        matches = safe_regex_search(DOMAIN_PATTERN, text)
        return [match.group(0) for match in matches]
    except RegexTimeoutError:
        return []

def extract_organizations(text):
    text = clean_input(text)
    try:
        matches = safe_regex_search(ORG_PATTERN, text)
        return [match.group(0) for match in matches]
    except RegexTimeoutError:
        return []

def extract_entities(text):
    ips = list(set(extract_ips(text)))
    domains = list(set(extract_domains(text)))
    organizations = list(set(extract_organizations(text)))
    
    return {
        'ips': ips,
        'domains': domains,
        'organizations': organizations,
        'total_count': len(ips) + len(domains) + len(organizations)
    }


extract_all_entities = extract_entities


def infer_relationships(entities, text):
    relationships = []
    text_lower = text.lower()
    
    for org in entities.get('organizations', []):
        for ip in entities.get('ips', []):
            if org.lower() in text_lower and ip in text:
                org_pos = text_lower.find(org.lower())
                ip_pos = text.find(ip)
                if abs(org_pos - ip_pos) < 500:
                    relationships.append({
                        'source': org,
                        'source_type': 'organization',
                        'target': ip,
                        'target_type': 'ip',
                        'relationship': 'USES_IP'
                    })
    
    for org in entities.get('organizations', []):
        for domain in entities.get('domains', []):
            if org.lower() in text_lower and domain.lower() in text_lower:
                org_pos = text_lower.find(org.lower())
                domain_pos = text_lower.find(domain.lower())
                if abs(org_pos - domain_pos) < 500:
                    relationships.append({
                        'source': org,
                        'source_type': 'organization',
                        'target': domain,
                        'target_type': 'domain',
                        'relationship': 'USES_DOMAIN'
                    })
    
    return relationships

if __name__ == '__main__':
    test_text = """
    APT28 使用 IP 地址 192.168.1.1 和 10.0.0.1 进行攻击。
    他们控制的域名包括 malicious-server.com 和 evil-c2.org。
    Lazarus Group 也被称为 Hidden Cobra，是朝鲜的黑客组织。
    WannaCry 勒索软件在 2017 年造成了全球范围的破坏。
    联系邮箱: admin@example.com (这不会被提取为域名)
    """
    
    result = extract_entities(test_text)
    print("IP 地址:", result['ips'])
    print("域名:", result['domains'])
    print("攻击组织:", result['organizations'])
    print("总计提取:", result['total_count'])
