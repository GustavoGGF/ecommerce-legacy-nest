const fs = require('fs');
const file = 'backend/tests/ManagerService/manager.service.spec.ts';
let content = fs.readFileSync(file, 'utf8');

const mockCode = `
jest.mock('file-type', () => ({
  fileTypeFromBuffer: jest.fn().mockImplementation(() => Promise.resolve({ ext: 'png', mime: 'image/png' })),
}), { virtual: true });
`;

if (!content.includes('jest.mock(\'file-type\'')) {
    content = content.replace('describe("ManagerService - validateProduct", () => {', mockCode + '\n' + 'describe("ManagerService - validateProduct", () => {');
    fs.writeFileSync(file, content);
}
