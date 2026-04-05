import { App, MarkdownPostProcessorContext, Plugin, PluginSettingTab, Setting } from 'obsidian';
import { EditorView, PluginValue, ViewPlugin, ViewUpdate } from "@codemirror/view";

type ThemeType = 'dark' | 'light';

interface Style {
	name: string;
	css: string;
}

interface ImageBorderStyleSettings {
	borderRadius: string;
	borderWidth: number;
	borderColor: string;
	isContrastBased: boolean;
	theme: ThemeType;
	styles: Style[];
}

const DEFAULT_SETTINGS: ImageBorderStyleSettings = {
	borderRadius: 'sm',
	borderWidth: 0,
	borderColor: '#333333',
	isContrastBased: true,
	theme: 'dark',
	styles: [
		{ "name": "rounded-none", "css": "image-style-rounded-none" },
		{ "name": "rounded-xs", "css": "image-style-rounded-xs" },
		{ "name": "rounded-sm", "css": "image-style-rounded-sm" },
		{ "name": "rounded-md", "css": "image-style-rounded-md" },
		{ "name": "rounded-lg", "css": "image-style-rounded-lg" },
		{ "name": "rounded-xl", "css": "image-style-rounded-xl" },
		{ "name": "rounded-2xl", "css": "image-style-rounded-2xl" },
		{ "name": "rounded-3xl", "css": "image-style-rounded-3xl" },
		{ "name": "rounded-4xl", "css": "image-style-rounded-4xl" },
		{ "name": "width-none", "css": "image-border-width-none" },
		{ "name": "width-thin", "css": "image-border-width-thin" },
		{ "name": "width-standard", "css": "image-border-width-standard" },
		{ "name": "width-thick", "css": "image-border-width-thick" },
		{ "name": "width-medium-heavy", "css": "image-border-width-medium-heavy" },
		{ "name": "width-heavy", "css": "image-border-width-heavy" },
		{ "name": "color-light", "css": "image-border-color-light" },
		{ "name": "color-dark", "css": "image-border-color-dark" },
	]
}

const BORDER_WIDTH_MAP: Record<number, string> = {
	0: "width-none",
	1: "width-thin",
	2: "width-standard",
	3: "width-thick",
	4: "width-medium-heavy",
	5: "width-heavy",
}

class ThemeAwareBorderColor {
	theme: ThemeType;
	isContrastBased: boolean;
	isDarkMode: boolean;
	color: string;

	constructor(theme: ThemeType, isDarkMode: boolean, isContrastBased: boolean, color: string) {
		this.theme = theme;
		this.isDarkMode = isDarkMode;
		this.isContrastBased = isContrastBased;
		if (this.isDarkMode === true) this.theme = 'dark';
		else this.theme = 'light';
		this.color = color;
		this.setBorderColorCSS()
	}

	setBorderColorCSS(): void {
		document.documentElement.style.setProperty('--border-color-custom', this.color);
	}

	getColorClass(): string {
		if (this.isContrastBased && this.theme === 'dark') {
			return 'color-dark';
		} else if (this.theme === 'light') {
			return 'color-light';
		}
		return 'color-custom';
	}
	getColor(): string {
		if (this.isContrastBased && this.theme === 'dark') {
			return '#333333';
		} else if (this.theme === 'light') {
			return '#e0e0e0';
		}
		return this.color;
	}
}

export class ApplyImageBorder implements PluginValue {
	view: EditorView;
	viewUpdate: ViewUpdate;
	plugin: ImageStyle;
	themeAwareBorderColor: ThemeAwareBorderColor;

	constructor(view: EditorView, plugin: ImageStyle) {
		this.view = view;
		this.plugin = plugin;
		this.themeAwareBorderColor = new ThemeAwareBorderColor(
			this.plugin.settings.theme,
			this.plugin.app.isDarkMode(),
			this.plugin.settings.isContrastBased,
			this.plugin.settings.borderColor
		);
		// console.log("ApplyImageBorder initialized with plugin settings:", this.plugin.settings);
	}

	update(update: ViewUpdate) {
		this.viewUpdate = update

		const images = update.view.dom.getElementsByTagName("img")
		Array.from(images).forEach((img: any) => {
			this.applyBorderRadius(img)
			this.applyBorderWidth(img)
			this.applyBorderColor(img)
		})
	}

	applyBorderRadius(img: HTMLImageElement) {
		const imageBorderRadiusClassName = "image-style-rounded-" + this.plugin.settings.borderRadius;
		img.classList.add(imageBorderRadiusClassName);
	}

	applyBorderWidth(img: HTMLImageElement) {
		const imageBorderWidthClassName = "image-border-" + BORDER_WIDTH_MAP[this.plugin.settings.borderWidth];
		img.classList.add(imageBorderWidthClassName);
		img.classList.add("image-border-solid");
	}

	applyBorderColor(img: HTMLImageElement) {
		// const imageBorderColorClassName = "image-border-" + this.themeAwareBorderColor.getColorClass();
		const imageBorderColorClassName = "image-border-color-light";
		img.classList.add(imageBorderColorClassName);
	}

	destroy() {
		// Cleanup logic if needed
	}
}

export default class ImageStyle extends Plugin {
	settings: ImageBorderStyleSettings;
	observers: MutationObserver[] = [];

	async onload() {
		await this.loadSettings();

		this.registerMarkdownPostProcessor((el, ctx) => {
			this.processImages(el, ctx);
		});

		this.registerEditorExtension(
			ViewPlugin.define((view) => new ApplyImageBorder(view, this))
		);

		// This adds a settings tab so the user can configure various aspects of the plugin
		this.addSettingTab(new ImageStyleSettingTab(this.app, this));
	}

	onunload() {
		this.observers.forEach(observer => observer.disconnect());
		this.observers = [];
	}

	processImages(el: HTMLElement, ctx: MarkdownPostProcessorContext) {
		// console.log("processImages", el);
		const images = el.getElementsByTagName("img");
		// console.log("processImages.images", images);
		Array.from(images).forEach((img: HTMLImageElement) => {
			this.applyBorderRadius(img);
			this.applyBorderWidth(img);
			this.applyBorderColor(img);
		});

		const observer = new MutationObserver((mutationsList, observer) => {
			for (const mutation of mutationsList) {
				if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
					mutation.addedNodes.forEach(node => {
						if (node instanceof HTMLImageElement) {
							this.applyBorderRadius(node);
							this.applyBorderWidth(node);
							this.applyBorderColor(node);
						} else if (node instanceof Element) {
							const images = node.querySelectorAll('img');
							images.forEach(this.applyBorderRadius);
							images.forEach(this.applyBorderWidth);
							images.forEach(this.applyBorderColor);
						}
					});
				}
			}
		});

		observer.observe(el, { childList: true, subtree: true });
		this.observers.push(observer); // Keep track of observers

		// Return an object with an unload function for cleanup
		return {
			unload: () => {
				observer.disconnect();
				this.observers = this.observers.filter(obs => obs !== observer);
				// console.log('MutationObserver disconnected for:', el); // Optional logging
			},
		};
	}

	applyBorderRadius(img: HTMLImageElement) {
		const imageBorderRadiusClassName = "image-style-rounded-" + this.settings.borderRadius
		img.classList.add(imageBorderRadiusClassName);
	}
	applyBorderWidth(img: HTMLImageElement) {
		const imageBorderWidthClassName = "image-border-" + BORDER_WIDTH_MAP[this.settings.borderWidth];
		img.classList.add(imageBorderWidthClassName);
		img.classList.add("image-border-solid");
	}
	applyBorderColor(img: HTMLImageElement) {
		const themeAwareBorderColor = new ThemeAwareBorderColor(
			this.settings.theme,
			this.app.isDarkMode(),
			this.settings.isContrastBased,
			this.settings.borderColor
		);

		const imageBorderColorClassName = "image-border-" + themeAwareBorderColor.getColorClass();
		img.classList.add(imageBorderColorClassName);
	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}
}


class ImageStyleSettingTab extends PluginSettingTab {
	plugin: ImageStyle;

	constructor(app: App, plugin: ImageStyle) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;

		containerEl.empty();

		const rounderBorderSetting = new Setting(containerEl)
		rounderBorderSetting
			.setName("Rounded borders")
			.setDesc("Select the border radius of images.")
			.addDropdown((text) =>
				text
					.addOption("none", "No border")
					.addOption("xs", "Extra small")
					.addOption("sm", "Small")
					.addOption("md", "Medium")
					.addOption("lg", "Large")
					.addOption("xl", "Extra large")
					.addOption("2xl", "2XL")
					.addOption("3xl", "3XL")
					.addOption("4xl", "4XL")
					.setValue(this.plugin.settings.borderRadius)
					.onChange(async (value) => {
						this.plugin.settings.borderRadius = value
						await this.plugin.saveSettings()
					})
			)

		containerEl.createEl("h2", { text: "Border Stroke" });

		const borderWidthSetting = new Setting(containerEl)

		borderWidthSetting
			.setName("Border Width")
			.setDesc("Select the global border width for images.")
			// .addSlider(slider => slider.setDynamicTooltip())
			.addSlider((number) =>
				number
					.setLimits(0, 5, 1)
					.setDynamicTooltip()
					.setValue(this.plugin.settings.borderWidth)
					.onChange(async (value) => {
						this.plugin.settings.borderWidth = value
						await this.plugin.saveSettings()
					})
			)

		containerEl.createEl("h2", { text: "Border Color" });

		// Add theme toggle
		const borderColorContrastModeSetting = new Setting(containerEl)
		borderColorContrastModeSetting
			.setName("Contrast Mode")
			.setDesc("Enable border color contrast based on theme")
			.addToggle((toggle) => {
				toggle.setValue(this.plugin.settings.isContrastBased);
				toggle.onChange(async (value) => {
					this.plugin.settings.isContrastBased = value
					borderColorSetting.setDisabled(value);
					await this.plugin.saveSettings()
				})
			})
		// Add color picker with theme support
		const borderColorSetting = new Setting(containerEl)
		borderColorSetting
			.setName("Border Color")
			.setDesc("Color for image borders")
			.addColorPicker((color) => {
				color.setValue(this.plugin.settings.borderColor);
				color.onChange(async (value) => {
					this.plugin.settings.borderColor = value
					await this.plugin.saveSettings()
				})
			})
			.setDisabled(this.plugin.settings.isContrastBased)
			.setTooltip("Disabled if Contrast Mode is enabled")
	}
}
