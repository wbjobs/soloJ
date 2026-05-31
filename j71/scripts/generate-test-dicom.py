#!/usr/bin/env python3
"""
生成测试用的 DICOM 文件
需要安装 pydicom: pip install pydicom
"""

import os
import sys
from datetime import datetime

try:
    import pydicom
    from pydicom.dataset import Dataset, FileDataset, FileMetaDataset
    from pydicom.uid import ExplicitVRLittleEndian, generate_uid
    from pydicom.sequence import Sequence
except ImportError:
    print("请先安装 pydicom: pip install pydicom")
    sys.exit(1)

import numpy as np


def create_test_dicom(output_path: str, patient_name: str = "张三^三", patient_id: str = "P12345678"):
    """创建一个简单的测试 DICOM 文件"""
    
    file_meta = FileMetaDataset()
    file_meta.MediaStorageSOPClassUID = "1.2.840.10008.5.1.4.1.1.2"
    file_meta.MediaStorageSOPInstanceUID = generate_uid()
    file_meta.TransferSyntaxUID = ExplicitVRLittleEndian
    file_meta.ImplementationClassUID = generate_uid()

    ds = FileDataset(
        output_path,
        {},
        file_meta=file_meta,
        preamble=b"\x00" * 128,
    )

    ds.PatientName = patient_name
    ds.PatientID = patient_id
    ds.PatientBirthDate = "19900115"
    ds.PatientSex = "M"
    
    ds.StudyInstanceUID = generate_uid()
    ds.SeriesInstanceUID = generate_uid()
    ds.SOPInstanceUID = file_meta.MediaStorageSOPInstanceUID
    
    ds.StudyDate = datetime.now().strftime("%Y%m%d")
    ds.StudyTime = datetime.now().strftime("%H%M%S")
    ds.AccessionNumber = f"ACC-{datetime.now().strftime('%Y%m%d')}-00123"
    ds.InstitutionName = "XX市第一人民医院"
    ds.ReferringPhysicianName = "李医生"
    ds.StudyDescription = "胸部CT平扫"
    ds.SeriesDescription = "轴位 5mm"
    ds.Modality = "CT"
    ds.Manufacturer = "GE Healthcare"
    
    ds.Rows = 512
    ds.Columns = 512
    ds.BitsAllocated = 16
    ds.BitsStored = 12
    ds.HighBit = 11
    ds.PixelRepresentation = 0
    ds.SamplesPerPixel = 1
    ds.PhotometricInterpretation = "MONOCHROME2"
    ds.WindowCenter = 40
    ds.WindowWidth = 400
    
    image_data = np.zeros((512, 512), dtype=np.uint16)
    for y in range(512):
        for x in range(512):
            dx = x - 256
            dy = y - 256
            dist = np.sqrt(dx * dx + dy * dy)
            if dist < 100:
                val = 2000 - int(dist * 15)
                image_data[y, x] = max(0, min(4095, val))
            elif dist < 150:
                image_data[y, x] = 500
            else:
                image_data[y, x] = 100
    
    ds.PixelData = image_data.tobytes()
    
    ds.save_as(output_path)
    print(f"✓ 已创建测试 DICOM 文件: {output_path}")
    print(f"  患者姓名: {patient_name}")
    print(f"  患者ID: {patient_id}")
    print(f"  分辨率: 512 x 512")


def main():
    output_dir = os.path.join(os.path.dirname(__file__), "..", "test-data")
    os.makedirs(output_dir, exist_ok=True)
    
    patients = [
        ("张三^三", "P12345678"),
        ("李四^四", "P87654321"),
        ("王五^五", "P20240001"),
    ]
    
    for i, (name, pid) in enumerate(patients, 1):
        output_path = os.path.join(output_dir, f"test_{i:03d}.dcm")
        create_test_dicom(output_path, name, pid)
    
    print(f"\n共创建 {len(patients)} 个测试 DICOM 文件")
    print(f"文件位置: {os.path.abspath(output_dir)}")
    print("\n您可以使用这些文件来测试 DICOM 解析系统。")


if __name__ == "__main__":
    main()
