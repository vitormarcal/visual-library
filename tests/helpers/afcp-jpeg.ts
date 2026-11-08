// Synthetic metadata, including embedded JPEGs, without production images.
export const withAfcpMetadata = (jpeg: Buffer, littleEndian = false): Buffer => {
  const values = [Buffer.from('synthetic IPTC'), Buffer.concat([Buffer.alloc(10), jpeg]), Buffer.concat([Buffer.alloc(10), jpeg])]
  const tags = ['IPTC', 'Nail', 'PrVw']
  const header = Buffer.alloc(12 + values.length * 12), footer = Buffer.alloc(12)
  const signature = littleEndian ? 'AXS*' : 'AXS!'
  const u16 = (b: Buffer, value: number, offset: number) => littleEndian ? b.writeUInt16LE(value, offset) : b.writeUInt16BE(value, offset)
  const u32 = (b: Buffer, value: number, offset: number) => littleEndian ? b.writeUInt32LE(value, offset) : b.writeUInt32BE(value, offset)
  header.write(signature, 0, 'latin1')
  u16(header, 1, 4)
  u16(header, values.length, 6)
  let offset = jpeg.length + header.length
  values.forEach((value, index) => {
    const entry = 12 + index * 12
    header.write(tags[index]!, entry, 'latin1')
    u32(header, value.length, entry + 4)
    u32(header, offset, entry + 8)
    offset += value.length
  })
  footer.write(signature, 0, 'latin1')
  u32(footer, jpeg.length, 4)
  return Buffer.concat([jpeg, header, ...values, footer])
}
