/**
 * Helper functions for creating dummy files in tests
 */

/**
 * Creates a dummy file with specified properties
 * @param name - File name
 * @param type - MIME type
 * @param size - File size in bytes (default: 1024)
 * @param content - File content (default: 'dummy content')
 * @returns File object
 */
export const createDummyFile = (
  name: string,
  type: string,
  size: number = 1024,
  content: string = 'dummy content'
): File => {
  const file = new File([content], name, { type });
  Object.defineProperty(file, 'size', { value: size, writable: false });
  return file;
};

/**
 * Creates a dummy PDF file
 * @param name - File name (default: 'test-document.pdf')
 * @param size - File size in bytes (default: 2048)
 * @returns PDF File object
 */
export const createDummyPDF = (name: string = 'test-document.pdf', size: number = 2048): File => {
  const pdfContent = '%PDF-1.4\n1 0 obj\n<<\n/Type /Catalog\n>>\nendobj\nxref\n0 1\ntrailer\n<<\n/Root 1 0 R\n>>\n%%EOF';
  return createDummyFile(name, 'application/pdf', size, pdfContent);
};

/**
 * Creates a dummy DOC file
 * @param name - File name (default: 'test-document.doc')
 * @param size - File size in bytes (default: 3072)
 * @returns DOC File object
 */
export const createDummyDOC = (name: string = 'test-document.doc', size: number = 3072): File => {
  return createDummyFile(name, 'application/msword', size);
};

/**
 * Creates a dummy DOCX file
 * @param name - File name (default: 'test-document.docx')
 * @param size - File size in bytes (default: 4096)
 * @returns DOCX File object
 */
export const createDummyDOCX = (name: string = 'test-document.docx', size: number = 4096): File => {
  return createDummyFile(name, 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', size);
};

/**
 * Creates a dummy TXT file
 * @param name - File name (default: 'test-document.txt')
 * @param size - File size in bytes (default: 1024)
 * @param content - File content (default: 'This is a test document.')
 * @returns TXT File object
 */
export const createDummyTXT = (
  name: string = 'test-document.txt',
  size: number = 1024,
  content: string = 'This is a test document.'
): File => {
  return createDummyFile(name, 'text/plain', size, content);
};

/**
 * Creates multiple dummy files of different types
 * @returns Array of File objects
 */
export const createMultipleDummyFiles = (): File[] => {
  return [
    createDummyPDF('application-form.pdf'),
    createDummyDOC('business-plan.doc'),
    createDummyDOCX('proposal.docx'),
    createDummyTXT('summary.txt', 512, 'Project summary document.'),
  ];
};

/**
 * Creates a file that exceeds the maximum allowed size (for testing validation)
 * @param name - File name (default: 'large-file.pdf')
 * @param maxSize - Maximum allowed size in bytes (default: 10MB)
 * @returns File object that exceeds the maximum size
 */
export const createOversizedFile = (
  name: string = 'large-file.pdf',
  maxSize: number = 10 * 1024 * 1024
): File => {
  return createDummyPDF(name, maxSize + 1024); // Exceeds by 1KB
};

/**
 * Creates a file with an unsupported MIME type (for testing validation)
 * @param name - File name (default: 'image.jpg')
 * @returns File object with unsupported type
 */
export const createUnsupportedFile = (name: string = 'image.jpg'): File => {
  return createDummyFile(name, 'image/jpeg', 2048);
};

