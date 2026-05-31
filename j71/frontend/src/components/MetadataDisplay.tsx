import React from 'react';
import type { DicomMetadata } from '../types';

interface MetadataDisplayProps {
  metadata: DicomMetadata | null;
  onSubmitAudit: () => void;
  isSubmitting: boolean;
  auditSubmitted: boolean;
}

const MetadataDisplay: React.FC<MetadataDisplayProps> = ({
  metadata,
  onSubmitAudit,
  isSubmitting,
  auditSubmitted,
}) => {
  if (!metadata) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-semibold text-gray-800 mb-4">DICOM 元数据</h2>
        <p className="text-gray-500">上传文件后将显示提取的元数据</p>
      </div>
    );
  }

  const sensitiveFields = [
    { label: '患者姓名', key: 'patient_name', value: metadata.patient_name },
    { label: '患者 ID', key: 'patient_id', value: metadata.patient_id },
    { label: '出生日期', key: 'patient_birth_date', value: metadata.patient_birth_date },
    { label: '性别', key: 'patient_sex', value: metadata.patient_sex },
    { label: '检查日期', key: 'study_date', value: metadata.study_date },
    { label: '检查时间', key: 'study_time', value: metadata.study_time },
    { label: ' accession 号', key: 'accession_number', value: metadata.accession_number },
    { label: '医疗机构', key: 'institution_name', value: metadata.institution_name },
    { label: '申请医生', key: 'referring_physician', value: metadata.referring_physician },
  ];

  const otherFields = [
    { label: '检查描述', key: 'study_description', value: metadata.study_description },
    { label: '序列描述', key: 'series_description', value: metadata.series_description },
    { label: '检查类型', key: 'modality', value: metadata.modality },
    { label: '设备厂商', key: 'manufacturer', value: metadata.manufacturer },
    { label: '图像行数', key: 'rows', value: metadata.rows.toString() },
    { label: '图像列数', key: 'columns', value: metadata.columns.toString() },
    { label: '分配位数', key: 'bits_allocated', value: metadata.bits_allocated.toString() },
    { label: '存储位数', key: 'bits_stored', value: metadata.bits_stored.toString() },
    { label: '采样数/像素', key: 'samples_per_pixel', value: metadata.samples_per_pixel.toString() },
    { label: '光度解释', key: 'photometric_interpretation', value: metadata.photometric_interpretation },
  ];

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold text-gray-800">DICOM 元数据</h2>
        <button
          onClick={onSubmitAudit}
          disabled={isSubmitting || auditSubmitted}
          className={`px-4 py-2 rounded-lg font-medium transition-colors ${
            auditSubmitted
              ? 'bg-green-100 text-green-700 cursor-not-allowed'
              : isSubmitting
              ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
              : 'bg-blue-600 text-white hover:bg-blue-700'
          }`}
        >
          {auditSubmitted
            ? '✓ 已提交审计'
            : isSubmitting
            ? '提交中...'
            : '提交审计日志'}
        </button>
      </div>

      <div className="mb-6">
        <h3 className="text-lg font-medium text-red-600 mb-3 flex items-center">
          <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
          敏感元数据（将被哈希化存储）
        </h3>
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {sensitiveFields.map((field) => (
              <div key={field.key} className="flex flex-col">
                <span className="text-xs font-medium text-red-700 uppercase tracking-wide">
                  {field.label}
                </span>
                <span className="text-sm text-gray-800 font-medium">
                  {field.value || '(空)'}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div>
        <h3 className="text-lg font-medium text-gray-700 mb-3">其他信息</h3>
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {otherFields.map((field) => (
              <div key={field.key} className="flex flex-col">
                <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                  {field.label}
                </span>
                <span className="text-sm text-gray-700">
                  {field.value || '(空)'}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default MetadataDisplay;
