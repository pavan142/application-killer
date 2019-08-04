const Applet = imports.ui.applet;
const Util = imports.misc.util;
const GLib = imports.gi.GLib;
const PopupMenu = imports.ui.popupMenu;
const NMClient = imports.gi.NMClient;
const Lang = imports.lang;
const St = imports.gi.St;
const Cinnamon = imports.gi.Cinnamon;
const SignalManager = imports.misc.signalManager;
const Mainloop = imports.mainloop;
const Main = imports.ui.main;


const prettyLog = (message) => {
	global.log("application-killer: " + message)
}

const MAX_TITLE_LENGTH = 30;

class ProcessItem extends PopupMenu.PopupBaseMenuItem {
	constructor(title, name, metaWindow, parent) {
		super();
		this.title = name;
		this.name = name;
		this.metaWindow = metaWindow;
		this.parent = parent;
		this.instances = [];
		this.signals = new SignalManager.SignalManager(null);
		this.tracker = Cinnamon.WindowTracker.get_default();
		this.app = this.tracker.get_window_app(this.metaWindow);
		this.addLabels();
		this.addInstance(metaWindow);
	}

	addInstance(metaWindow) {
		this.instances.push(metaWindow);
		this.signals.connect(metaWindow, "unmanaged", Lang.bind(this, this.removeInstance, metaWindow));
		this._instanceslabel.set_text(this.instances.length.toString())
	}

	removeInstance(metaWindow) {

		let i = this.instances.length;

		while (i--)
			if (this.instances[i] === metaWindow)
				this.instances.splice(i, 1);

		if (this.instances.length == 0) {
			this.emit("processitemdestroyed");
			this.parent._processItemRemoved(this.app, this);
			this.destroy()
		}

		this._instanceslabel.set_text(this.instances.length.toString())
	}

	setDisplayTitle() {
		let title = this.metaWindow.get_title();


		if (!title) title = this.app ? this.app.get_name() : '?';
		this.title = title;
		this.label.set_text(title.substr(0, MAX_TITLE_LENGTH));
	}

	addLabels() {
		let appIcon = this.app.create_icon_texture_for_window(20, this.metaWindow);
		this.addActor(appIcon);

		this.label = new St.Label({ text: this.title.substr(0, MAX_TITLE_LENGTH) })
		this.addActor(this.label);
		this.actor.label_actor = this.label;

		this._instanceslabel = new St.Label({ text: this.instances.length.toString() })
		this.addActor(this._instanceslabel);

		let closeButton = new St.Button();
		let icon = new St.Icon({ icon_name: "close-window", icon_size: 20, icon_type: St.IconType.FULLCOLOR, reactive: true, track_hover: true });
		closeButton.set_child(icon);
		closeButton.connect("clicked", Lang.bind(this, this._onCloseClicked));
		this.addActor(closeButton);
	}

	_onCloseClicked() {
		for (let instance of this.instances)
			instance.delete(global.get_current_time());
	}
}

class MyApplet extends Applet.IconApplet {
	constructor(orientation, panel_height, instance_id) {
		super(orientation, panel_height, instance_id);
		this.set_applet_icon_name("gun2");
		this.set_applet_tooltip(_("Click here to kill a window"));
		this.setupMenus(orientation);
		this.signals = new SignalManager.SignalManager(null);
		this._windows = [];
		this.signals.connect(global.screen, 'window-added', this._onWindowAddedAsync, this);
		this.debug();
	}

	_onWindowAddedAsync(screen, metaWindow, monitor) {
		Mainloop.timeout_add(20, Lang.bind(this, this._onWindowAdded, metaWindow));
	}

	_onWindowAdded(metaWindow) {
		if (!this.shouldAddWindow(metaWindow))
			return;

		this._addWindow(metaWindow, false)
	}

	_addWindow(metaWindow, alert) {
		for (let window of this._windows)
			if (window.metaWindow == metaWindow && window.alert == alert)
				return;

		let tracker = Cinnamon.WindowTracker.get_default();
		let app = tracker.get_window_app(metaWindow);

		let i = this._windows.length;
		while (i--)
			if (this._windows[i].app == app)
				return this._windows[i].addInstance(metaWindow);

		let title = metaWindow.get_title();
		let name = app.get_name();

		if (!title) title = app ? app.get_name() : '?';

		let newProcessItem = new ProcessItem(title, name, metaWindow, this);
		this.menu.addMenuItem(newProcessItem);
		this._windows.push(newProcessItem);
	}

	_processItemRemoved(app, item) {
		let i = this._windows.length;
		while (i--)
			if (this._windows[i] == item)
				this._windows.splice(i, 1);
	}

	_removeWindow(metaWindow) {
		let i = this._windows.length;
		while (i--)
			if (this._windows[i].metaWindow == metaWindow)
				this._windows.splice(i, 1);
	}

	shouldAddWindow(metaWindow) {
		return Main.isInteresting(metaWindow)
	}

	setupMenus(orientation) {
		this.menuManager = new PopupMenu.PopupMenuManager(this);
		this.menu = new Applet.AppletPopupMenu(this, orientation);
		this.menuManager.addMenu(this.menu);
	}

	debug() {
		this.getAllCurrentWindows();
	}

	on_applet_clicked() {
		this.menu.toggle();
	}

	getAllCurrentWindows() {
		for (let i = 0; i < global.screen.n_workspaces; ++i) {
			let workspace = global.screen.get_workspace_by_index(i);
			let windows = workspace.list_windows();
			for (let window of windows)
				this._onWindowAdded(window)
		}
	}
}

function main(metadata, orientation, panel_height, instance_id) {
	return new MyApplet(orientation, panel_height, instance_id);
}