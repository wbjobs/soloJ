import Task from './Task.js';
import AlignmentHistory from './AlignmentHistory.js';
import SubtitleCorrection from './SubtitleCorrection.js';
import ModelVersion from './ModelVersion.js';
import ABTest from './ABTest.js';
import ABTestAssignment from './ABTestAssignment.js';
import TrainingBatch from './TrainingBatch.js';
import CalibrationReport from './CalibrationReport.js';

Task.hasMany(AlignmentHistory, {
  foreignKey: 'taskId',
  as: 'alignmentHistories',
  onDelete: 'CASCADE'
});

Task.hasMany(SubtitleCorrection, {
  foreignKey: 'taskId',
  as: 'subtitleCorrections',
  onDelete: 'CASCADE'
});

Task.hasMany(CalibrationReport, {
  foreignKey: 'taskId',
  as: 'calibrationReports',
  onDelete: 'CASCADE'
});

Task.hasMany(ABTestAssignment, {
  foreignKey: 'taskId',
  as: 'abTestAssignments',
  onDelete: 'CASCADE'
});

AlignmentHistory.belongsTo(Task, {
  foreignKey: 'taskId',
  as: 'task'
});

SubtitleCorrection.belongsTo(Task, {
  foreignKey: 'taskId',
  as: 'task'
});

SubtitleCorrection.belongsTo(TrainingBatch, {
  foreignKey: 'trainingBatchId',
  as: 'trainingBatch'
});

CalibrationReport.belongsTo(Task, {
  foreignKey: 'taskId',
  as: 'task'
});

ModelVersion.hasMany(TrainingBatch, {
  foreignKey: 'modelVersionId',
  as: 'trainingBatches'
});

TrainingBatch.belongsTo(ModelVersion, {
  foreignKey: 'modelVersionId',
  as: 'modelVersion'
});

TrainingBatch.hasMany(SubtitleCorrection, {
  foreignKey: 'trainingBatchId',
  as: 'subtitleCorrections'
});

ABTest.belongsTo(ModelVersion, {
  foreignKey: 'modelAId',
  as: 'modelA'
});

ABTest.belongsTo(ModelVersion, {
  foreignKey: 'modelBId',
  as: 'modelB'
});

ABTest.belongsTo(ModelVersion, {
  foreignKey: 'winnerId',
  as: 'winner'
});

ABTest.hasMany(ABTestAssignment, {
  foreignKey: 'abTestId',
  as: 'assignments',
  onDelete: 'CASCADE'
});

ABTestAssignment.belongsTo(ABTest, {
  foreignKey: 'abTestId',
  as: 'abTest'
});

ABTestAssignment.belongsTo(Task, {
  foreignKey: 'taskId',
  as: 'task'
});

ABTestAssignment.belongsTo(ModelVersion, {
  foreignKey: 'assignedModelId',
  as: 'assignedModel'
});

export {
  Task,
  AlignmentHistory,
  SubtitleCorrection,
  ModelVersion,
  ABTest,
  ABTestAssignment,
  TrainingBatch,
  CalibrationReport
};
