import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createApp } from './app.js';
export async function startServer(
  options: { dataDir?: string; port?: number; frontendDir?: string } = {},
) {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
  const { app, store } = await createApp(
    options.dataDir || process.env.STUDIES_DATA_DIR || path.join(process.cwd(), '.data'),
    options.frontendDir || path.join(root, 'dist'),
  );
  const server = app.listen(options.port ?? Number(process.env.PORT || 4318), '127.0.0.1');
  await new Promise<void>((resolve, reject) => {
    server.once('listening', () => resolve());
    server.once('error', reject);
  });
  const address = server.address();
  console.log(
    `Cronograma de Estudos iniciado na porta ${typeof address === 'object' ? address?.port : ''}. Dados: ${store.dataDir}`,
  );
  return { server, store };
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url))
  startServer().catch((e) => {
    console.error(e);
    process.exitCode = 1;
  });
