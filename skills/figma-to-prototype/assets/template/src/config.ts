/**
 * Prototype settings — filled in from the Figma file when the project is created.
 *
 * mode  'app' → the screens render inside a phone mockup on a laptop and go
 *               full-bleed (no mock status bar / home indicator / rounded frame)
 *               on a real phone.
 *       'web' → plain responsive page, no mockup.
 * frame  the Figma frame size the screens were designed at (app mode). The
 *        mockup uses it on desktop; on a real phone the layout is fluid.
 * statusBar / homeIndicator  heights of those bars in the Figma frame (44/34 on
 *        a 375×812 frame, 47 or 54 on newer iPhone frames, 24/0 on Android).
 */
export const config = {
  mode: '__MODE__' as 'app' | 'web',
  frame: { width: __FRAME_W__, height: __FRAME_H__ },
  statusBar: __STATUS_H__,
  homeIndicator: __HOME_H__,
}
