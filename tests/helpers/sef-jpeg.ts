// Synthetic metadata: no personal images or device data in regression fixtures.
export const withSefMetadata = (jpeg: Buffer, sizes = [38, 58]): Buffer => {
  const records = sizes.map((size, index) => {
    const record = Buffer.alloc(size, 97)
    record.writeUInt16LE(0, 0)
    record.writeUInt16LE(index ? 0x0da1 : 0x0c51, 2)
    record.writeUInt32LE(6, 4)
    record.write('sample', 8, 'ascii')
    return record
  })
  const metadataSize = records.reduce((total, record) => total + record.length, 0)
  const directorySize = 12 + records.length * 12
  const directory = Buffer.alloc(directorySize + 8)
  directory.write('SEFH', 0, 'ascii')
  directory.writeUInt32LE(107, 4)
  directory.writeUInt32LE(records.length, 8)
  let start = 0
  records.forEach((record, index) => {
    const entry = 12 + index * 12
    record.copy(directory, entry, 0, 4)
    directory.writeUInt32LE(metadataSize - start, entry + 4)
    directory.writeUInt32LE(record.length, entry + 8)
    start += record.length
  })
  directory.writeUInt32LE(directorySize, directorySize)
  directory.write('SEFT', directorySize + 4, 'ascii')
  return Buffer.concat([jpeg, ...records, directory])
}
