# M3 Browser Acceptance — Local-First Projects

## Preparation

```bash
git switch feat/m3-local-first-projects
git pull
pnpm install --frozen-lockfile
pnpm dev
```

Open the URL printed by Next.js in a normal browser window. DevTools should show no uncaught errors during the scenarios below.

## 1. First launch and dashboard

1. Clear site data for the local Vlezet origin.
2. Reload the page.
3. Confirm that the empty `Мои проекты` dashboard appears.
4. Confirm that the UI explicitly says projects are stored in this browser on this device and are not sent to a server.
5. Press `Новый проект`.

Expected:

- a project named `Моя квартира` opens;
- the editor starts with an empty plan;
- the toolbar shows the project name and `Сохранено`;
- no account or registration is requested.

## 2. Autosave and reload recovery

1. Draw a rectangular room.
2. Add one door and one window.
3. Name the room `Спальня`.
4. Place a double bed and a wardrobe.
5. Move and rotate the wardrobe.
6. Wait until the toolbar says `Сохранено`.
7. Pan and zoom the plan, then wait one second.
8. Reload the page completely.

Expected:

- the same project opens automatically;
- walls, openings, room name, furniture, dimensions and rotation are restored;
- camera position and zoom are restored approximately exactly;
- undo history is fresh after reload, while the actual document remains intact.

## 3. Project name

1. Click the project name in the toolbar.
2. Rename it to `Квартира в Новых Ватутинках` and press Enter.
3. Wait for `Сохранено`.
4. Return to projects with the arrow button.

Expected:

- the dashboard card has the new name;
- its modification time is updated;
- the card shows reasonable room, wall and furniture counts.

## 4. Multiple independent projects

1. On the dashboard create another project.
2. Draw a different small room and add one chair.
3. Return to the dashboard.
4. Open the first project.

Expected:

- both project cards exist;
- the first project is unchanged;
- no geometry or furniture leaks between projects.

## 5. Duplicate as an alternative layout

1. Return to the dashboard.
2. Press `Копия` on `Квартира в Новых Ватутинках`.
3. Open the generated `Квартира в Новых Ватутинках — копия`.
4. Move the bed and delete the wardrobe.
5. Save and reopen the original.

Expected:

- the copy starts geometrically equivalent to the original;
- changes in the copy do not affect the original;
- both projects have independent timestamps and IDs.

## 6. Delete confirmation

1. Press `Удалить` on the temporary second project.
2. Confirm that focus starts on `Отмена`.
3. Press Escape and confirm nothing is deleted.
4. Open the dialog again and confirm deletion.

Expected:

- the dialog names the project;
- deletion is impossible without explicit confirmation;
- only the selected project disappears;
- remaining projects still open correctly after reload.

## 7. Furniture panel toggle

1. Open a project.
2. Press `F`.
3. Press `F` again.
4. Repeat using the `Мебель` toolbar button.

Expected:

- the catalogue hides and the canvas expands;
- it reappears without losing the plan or selection;
- the chosen state survives project reload;
- the state is stored independently per project.

## 8. Fit to plan

1. Pan far away and zoom in.
2. Press `Весь план`.
3. Resize the browser and press it again.

Expected:

- all walls, door swings and furniture fit inside the canvas with visible padding;
- the plan is centred;
- scale remains usable and finite;
- an empty project falls back to the normal default camera.

## 9. Vlezet JSON backup

1. Open the export menu.
2. Download `Vlezet JSON`.
3. Return to the dashboard and import the downloaded file.

Expected:

- a `.vlezet.json` file with a filesystem-safe name downloads;
- import creates a new independent local project;
- geometry, openings, room metadata, furniture and viewport match the exported project;
- the imported project receives a new local ID and fresh timestamps.

## 10. Invalid import

Try importing:

- a non-JSON text file renamed to `.json`;
- JSON with another `format` value;
- JSON with unsupported `fileVersion`;
- a Vlezet envelope with malformed document arrays.

Expected:

- a clear Russian error appears;
- no existing project changes;
- no partial project card is created;
- the currently open editor session remains intact.

## 11. PNG export

1. Create a recognisable plan with rooms, doors, windows and furniture.
2. Export PNG.
3. Open the downloaded image.

Expected:

- opaque white background;
- plan automatically cropped with padding;
- physical walls and real opening gaps;
- door leaves/arcs and windows;
- room names and areas;
- furniture footprints and labels;
- no grid, toolbar, catalogue, inspector, selections, Transformer, guides or warning overlays;
- image is sharp enough to share and its longest side does not exceed 8192 px.

## 12. Save failure behavior

Using DevTools, temporarily block/throw IndexedDB writes or revoke storage access, then edit the plan.

Expected:

- current in-memory work remains visible;
- toolbar shows `Не сохранено · повторить`;
- raw browser exception text is not shown;
- restoring storage and pressing retry saves the newest snapshot, not an older failed one.

## 13. Final persistence pass

1. Create or retain at least two projects.
2. Close the browser tab.
3. Start Vlezet again at the same origin.

Expected:

- the last open project is restored when appropriate;
- returning to the dashboard shows every saved project;
- all project data remains local to that browser profile.
