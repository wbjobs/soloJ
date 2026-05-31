from setuptools import setup, find_packages

setup(
    name="mqtt-sniffer",
    version="1.0.0",
    description="MQTT Packet Sniffer with Protocol Inference",
    author="MQTT Sniffer Team",
    packages=find_packages(),
    install_requires=[
        "paho-mqtt>=1.6.1",
        "scapy>=2.5.0",
        "python-dotenv>=1.0.0",
        "colorama>=0.4.6",
    ],
    entry_points={
        "console_scripts": [
            "mqtt-sniffer=mqtt_sniffer.main:main",
        ],
    },
    python_requires=">=3.8",
)
