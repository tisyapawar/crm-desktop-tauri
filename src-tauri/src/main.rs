#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use tauri::{
  menu::{Menu, MenuItem, PredefinedMenuItem, Submenu},
  Manager,
};

fn main() {
  tauri::Builder::default()
    .plugin(tauri_plugin_log::Builder::default().build())
    .plugin(tauri_plugin_dialog::init())
    .plugin(tauri_plugin_shell::init())
    .setup(|app| {
      // ----- Custom items -----
    //   let quit = MenuItem::with_id(app, "quit", "Quit", true, Some("CmdOrCtrl+Q"))?;
    //   let close = MenuItem::with_id(app, "close", "Close", true, None)?;
    let quit = MenuItem::with_id(app, "quit", "Quit", true, Some("CmdOrCtrl+Q"))?;
    let close = MenuItem::with_id(app, "close", "Close", true, None::<&str>)?;

      // ----- File menu -----
      let file_menu = Submenu::with_items(
        app,
        "File",
        true,
        &[&quit],
      )?;

      // ----- Edit menu -----
      let edit_menu = Submenu::with_items(
        app,
        "Edit",
        true,
        &[
          &PredefinedMenuItem::undo(app, None)?,
          &PredefinedMenuItem::redo(app, None)?,
          &PredefinedMenuItem::separator(app)?,
          &PredefinedMenuItem::cut(app, None)?,
          &PredefinedMenuItem::copy(app, None)?,
          &PredefinedMenuItem::paste(app, None)?,
          &PredefinedMenuItem::select_all(app, None)?,
        ],
      )?;

      // ----- View menu -----
      let view_menu = Submenu::with_items(
        app,
        "View",
        true,
        &[
          &PredefinedMenuItem::minimize(app, None)?,
          &PredefinedMenuItem::separator(app)?,
          &close,
        ],
      )?;

      // ----- Root menu -----
      let menu = Menu::with_items(
        app,
        &[&file_menu, &edit_menu, &view_menu],
      )?;

      app.set_menu(menu)?;

      // ----- Menu events -----
      app.on_menu_event(|app, event| {
        match event.id().as_ref() {
          "quit" => app.exit(0),
          "close" => {
            if let Some(window) = app.get_webview_window("main") {
              let _ = window.close();
            }
          }
          _ => {}
        }
      });

      // ----- Devtools -----
      #[cfg(debug_assertions)]
      if let Some(window) = app.get_webview_window("main") {
        window.open_devtools();
      }

      Ok(())
    })
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
