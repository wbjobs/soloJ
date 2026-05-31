"""测试可选导入的文件 - 包含各种try/except导入模式"""

import os
import sys

# 必需导入
import requests
import flask

# 可选导入模式1: 基础 try/except ImportError
try:
    import numpy as np
    import pandas as pd
except ImportError:
    np = None
    pd = None

# 可选导入模式2: ModuleNotFoundError
try:
    from lxml import etree
except ModuleNotFoundError:
    etree = None

# 可选导入模式3: 元组异常
try:
    import cv2
except (ImportError, OSError):
    cv2 = None

# 可选导入模式4: 空异常捕获
try:
    import matplotlib.pyplot as plt
except:
    plt = None

# 可选导入模式5: 函数内的条件导入
def get_optional_feature():
    """获取可选功能（如果库可用）"""
    try:
        import seaborn as sns
        return sns.__version__
    except ImportError:
        return None

# 可选导入模式6: 类中的条件导入
class OptionalFeature:
    def __init__(self):
        try:
            import torch
            self.torch = torch
            self.has_torch = True
        except ImportError:
            self.torch = None
            self.has_torch = False

    def get_tensor(self, data):
        if self.has_torch:
            return self.torch.tensor(data)
        return None

# 这个不是可选导入 - 捕获的是ValueError不是导入异常
try:
    import non_optional_lib
except ValueError:
    pass

# 嵌套try/except中的可选导入
try:
    try:
        import deep_learning_lib
    except ImportError:
        deep_learning_lib = None
except Exception:
    pass
