import { execFile } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { extname, join } from 'node:path';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

export async function extractRemoteDocumentText(url: string, name: string): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), 'lh-document-'));
  const extension = extname(name.toLowerCase());
  const input = join(directory, `source${extension}`);
  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`첨부파일 다운로드 실패 (${response.status})`);
    await writeFile(input, Buffer.from(await response.arrayBuffer()));
    if (extension === '.pdf') {
      const output = join(directory, 'content.txt');
      await execFileAsync('pdftotext', ['-layout', input, output], { maxBuffer: 50 * 1024 * 1024 });
      return await readFile(output, 'utf8');
    }
    if (extension === '.hwpx' || extension === '.hwtx') {
      const { stdout } = await execFileAsync('unzip', ['-p', input, 'Contents/section*.xml'], { maxBuffer: 50 * 1024 * 1024 });
      return stdout.replace(/<[^>]+>/g, ' ').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
    }
    throw new Error(`지원하지 않는 문서 형식: ${extension || '확장자 없음'}`);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}
