import assert from 'node:assert/strict'
import test from 'node:test'
import { discoveryImages } from '../app/utils/image-visibility.ts'
import { libraryDestination, libraryDestinationUrl, parseLibraryDestination } from '../app/utils/library-navigation.ts'
import { localImageError } from '../app/utils/image-upload.ts'
test('visibility modes preserve IDs and exclude the opposite set from discovery', () => {
  const images = [{ id:'old' }, {id:'public',hiddenFromGallery:false}, {id:'hidden',hiddenFromGallery:true}]
  assert.deepEqual(discoveryImages(images).map(i=>i.id), ['old','public'])
  assert.deepEqual(discoveryImages(images,true).map(i=>i.id), ['hidden'])
  const destination = {...libraryDestination(),hidden:true,imageId:'hidden',query:'name',tagIds:['tag']}
  assert.deepEqual(parseLibraryDestination(new URL(libraryDestinationUrl(destination),'http://local')), destination)
  for (const url of ['/?view=explore&visibility=hidden','/?view=subject&subject=a&visibility=hidden','/?view=library&visibility=no','/?view=library&visibility=hidden&visibility=hidden']) assert.ok(parseLibraryDestination(new URL(url,'http://local')).problem)
  assert.equal(localImageError({name:'a.png',type:'image/png',size:101},100)?.includes('too large'),true)
})
