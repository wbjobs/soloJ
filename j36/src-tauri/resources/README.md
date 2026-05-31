# 资源目录

此目录存放应用所需的额外资源文件。

## 目录结构

```
resources/
├── plugins/              # Calibre 插件目录
│   └── DeDRM.zip       # DeDRM 插件（用户自行安装）
├── keys/                 # DRM 密钥目录
│   ├── adobekey.der    # Adobe DRM 密钥
│   └── kindlekey.k4i   # Kindle 密钥
└── icons/                # 应用图标
    ├── 32x32.png
    ├── 128x128.png
    ├── icon.icns
    └── icon.ico
```

## 说明

- DRM 密钥文件不包含在发行包中，需要用户自行提供
- 请确保您对处理的电子书拥有合法使用权
- 密钥文件请妥善保管，勿分享给他人
