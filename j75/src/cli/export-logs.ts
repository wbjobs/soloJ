import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import { connectDatabase, disconnectDatabase } from '../db/connection';
import { operationLogRepository, documentRepository } from '../db';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

async function exportOperationLogs(docId: string, outputPath: string): Promise<void> {
  try {
    await connectDatabase();

    const meta = await documentRepository.getMetadata(docId);
    if (!meta) {
      console.error(`❌ Document ${docId} not found`);
      process.exit(1);
    }

    console.log(`📄 Document: ${meta.title} (${meta.id})`);
    console.log(`👤 Created by: ${meta.createdBy}`);
    console.log(`⏰ Created: ${meta.createdAt.toISOString()}`);
    console.log(`🔄 Last updated: ${meta.updatedAt.toISOString()}`);
    console.log();

    const operations = await operationLogRepository.getOperations(docId);

    if (operations.length === 0) {
      console.log('⚠️  No operations found for this document');
      process.exit(0);
    }

    console.log(`📊 Exporting ${operations.length} operations...`);

    const jsonData = await operationLogRepository.toJSONArray(operations);

    const exportData = {
      exportInfo: {
        exportedAt: new Date().toISOString(),
        documentId: docId,
        documentTitle: meta.title,
        totalOperations: operations.length,
      },
      document: meta,
      operations: jsonData,
    };

    const outputDir = path.dirname(outputPath);
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    fs.writeFileSync(outputPath, JSON.stringify(exportData, null, 2));

    const fileSize = fs.statSync(outputPath).size;
    console.log(`✅ Export complete!`);
    console.log(`📁 Output file: ${outputPath}`);
    console.log(`📦 File size: ${(fileSize / 1024 / 1024).toFixed(2)} MB`);
  } catch (error) {
    console.error('❌ Export failed:', error);
    process.exit(1);
  } finally {
    await disconnectDatabase();
  }
}

async function listDocuments(): Promise<void> {
  try {
    await connectDatabase();

    const docs = await documentRepository.listDocuments();

    if (docs.length === 0) {
      console.log('📭 No documents found');
      return;
    }

    console.log(`📚 Found ${docs.length} documents:\n`);
    console.log('ID'.padEnd(40) + 'Title'.padEnd(30) + 'Operations'.padEnd(12) + 'Updated');
    console.log('-'.repeat(100));

    for (const doc of docs) {
      const opCount = await operationLogRepository.getOperationCount(doc.id);
      console.log(
        doc.id.padEnd(40) +
        doc.title.padEnd(30).substring(0, 30) +
        String(opCount).padEnd(12) +
        doc.updatedAt.toISOString()
      );
    }
  } catch (error) {
    console.error('❌ Failed to list documents:', error);
    process.exit(1);
  } finally {
    await disconnectDatabase();
  }
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const command = args[0];

  switch (command) {
    case 'export': {
      const docId = args[1];
      const outputPath = args[2] || `./exports/${docId}-operations.json`;

      if (!docId) {
        console.error('❌ Usage: npx ts-node src/cli/export-logs.ts export <docId> [outputPath]');
        process.exit(1);
      }

      await exportOperationLogs(docId, outputPath);
      break;
    }

    case 'list': {
      await listDocuments();
      break;
    }

    default:
      console.log('📋 Collaborative Editor - Operation Log CLI Tool\n');
      console.log('Usage: npx ts-node src/cli/export-logs.ts <command> [options]\n');
      console.log('Commands:');
      console.log('  list                          List all documents');
      console.log('  export <docId> [outputPath]   Export operation logs for a document');
      console.log();
      console.log('Examples:');
      console.log('  npx ts-node src/cli/export-logs.ts list');
      console.log('  npx ts-node src/cli/export-logs.ts export abc123 ./logs/doc-abc123.json');
      console.log();
  }
}

if (require.main === module) {
  main();
}

export { exportOperationLogs, listDocuments };
