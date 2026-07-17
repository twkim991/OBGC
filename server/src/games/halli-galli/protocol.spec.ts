import { parseHalliGalliRevisionPayload } from './protocol';

describe('Halli Galli protocol', () => {
  it('accepts a non-negative board revision', () => {
    expect(parseHalliGalliRevisionPayload({ boardRevision: 4 })).toEqual({ boardRevision: 4 });
  });

  it('rejects malformed revisions', () => {
    expect(parseHalliGalliRevisionPayload({ boardRevision: -1 })).toBeNull();
    expect(parseHalliGalliRevisionPayload({ boardRevision: '4' })).toBeNull();
  });
});
