// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import { config } from 'process';
import { Disposable, ExtensionContext, StatusBarAlignment, StatusBarItem, WorkspaceConfiguration, window, workspace } from 'vscode';

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed

interface youshiConfig {
    verticalSize: number;
    horizontalSize: number;
    enableRuby: boolean;
    enableSidePoint: boolean;
    shortenNumber: boolean;
    shortenAlphabet: boolean;
    fillEOF: boolean;
    fillBracket: boolean;
    pageChangeSymbol: string;
}


function configSetter() {
	const extensionConfig: WorkspaceConfiguration = workspace.getConfiguration('youshicount');


	let verticalSize: number = extensionConfig.get<number>("verticalSize") ?? 20;
	if (verticalSize <= 0) {
		verticalSize = 20;
	}
	let horizontalSize: number = extensionConfig.get<number>("horizontalSize") ?? 20;
	if (horizontalSize <= 0) {
		horizontalSize = 20;
	}

	const configs: youshiConfig = {
		verticalSize: verticalSize,
		horizontalSize: horizontalSize,
		enableRuby: extensionConfig.get<boolean>("enableRuby") ?? true,
		enableSidePoint: extensionConfig.get<boolean>("enableSidePoint") ?? true,
		shortenNumber: extensionConfig.get<boolean>("shortenNumber") ?? false,
		shortenAlphabet: extensionConfig.get<boolean>("shortenAlphabet") ?? false,
		fillEOF: extensionConfig.get<boolean>("fillEOF") ?? true,
		fillBracket: extensionConfig.get<boolean>("fillBracket") ?? true,
		pageChangeSymbol: extensionConfig.get<string>("pageChangeSymbol") ?? "==="
	};
	return configs;
}

export function activate(ctx: ExtensionContext) {

	let counter = new Counter([configSetter()]);
	let controller = new CounterController(counter);

	ctx.subscriptions.push(controller);
	ctx.subscriptions.push(counter);
    ctx.subscriptions.push(workspace.onDidChangeConfiguration((e) =>{
        controller.updateConfigs([configSetter()]);
    }));
}

// This method is called when your extension is deactivated
export function deactivate() {}


class CounterController {
    private _counter: Counter;
    private _disposable: Disposable;
    constructor(counter: Counter) {
        this._counter = counter;
        this._counter.updateCount();
        let subscriptions: Disposable[] = [];
        window.onDidChangeTextEditorSelection(this._onEvent, this, subscriptions);
        window.onDidChangeActiveTextEditor(this._onEvent, this, subscriptions);
        this._disposable = Disposable.from(...subscriptions);
    }
    private _onEvent() {
        this._counter.updateCount();
    }
    public updateConfigs(configs: youshiConfig[]) {
        this._counter.updateConfigs(configs);
        this._counter.updateCount();
    }
    public dispose() {
        this._disposable.dispose();
    }

}

class Counter {
    private _statusBarItem : StatusBarItem;

    constructor (
        private _configs: youshiConfig[]
    ){
        this._statusBarItem = window.createStatusBarItem(StatusBarAlignment.Left);
    }

    public updateConfigs(configs: youshiConfig[]) {
        this._configs = configs;
    }

    public updateCount() {
        if (!this._statusBarItem) {
            this._statusBarItem = window.createStatusBarItem(StatusBarAlignment.Left);
        } 
        
        const editor = window.activeTextEditor;
        if (!editor) {
            this._statusBarItem.hide();
            return;
        }

        const doc = editor.document;
        if (doc.languageId === "markdown" || doc.languageId === "plaintext" || doc.languageId === "novel") {

            const content = doc.getText();
            let barTexts: string[] = [];
            this._configs.forEach(config =>{
                const results = this._getCount(content,config);
                barTexts.push(`${config.verticalSize}x${config.horizontalSize}: ${Math.floor(results.lineCount/20)+1}枚目 ${results.lineCount%20+1}行目`);
            });

            this._statusBarItem.text = barTexts.join("|");
            this._statusBarItem.show();
        } else {
            this._statusBarItem.hide();
        }
    }
    public _getCount(content: string, config: youshiConfig): {lineCount: number,lineCharCount: number} {
        let tempContent = content;
        if (config.pageChangeSymbol !== "") {
            tempContent = tempContent.replaceAll("\n"+config.pageChangeSymbol+"\n","\f");
        }
        if (config.enableSidePoint) {
            tempContent = tempContent.replace(/《《(.+)》》/g,"$1");
        }
        if (config.enableRuby) {
            tempContent = tempContent.replace(/\|(.+)《.+》/g,"$1");
            tempContent = tempContent.replace(/((?<![\u4E00-\u9FFF\u3005-\u3007])[\u4E00-\u9FFF\u3005-\u3007]+)《.+》/g,"$1");
        }
        if (config.shortenAlphabet && config.shortenNumber) {
            tempContent = tempContent.replace(/[a-zA-Z0-9]{2}/g,"N");
        }else {
            if (config.shortenAlphabet) {
                tempContent = tempContent.replace(/[a-zA-Z]{2}/g,"N");
            }
            if (config.shortenNumber) {
                tempContent = tempContent.replace(/[0-9]{2}/g,"N");
            }
            
        }
        if (config.fillBracket) {
            tempContent = tempContent.replace(/([。、])([」』）])/g,"$2");
        }

        let lineCount = 0;
        let lineCharCount = 0;
        for (let char of tempContent) {
            if (lineCharCount >= config.verticalSize && config.fillEOF) {
                if (["』","」","）","、","。"].includes(char)) {
                    continue;
                }
            }
            switch (char) {
                case "\n":
                    lineCount += 1;
                    lineCharCount = 0;
                    break;
                case "\f":
                    lineCount = Math.ceil(lineCount/config.horizontalSize)*config.horizontalSize;
                    lineCharCount = 0;
                    break;
                default:
                    if (lineCharCount >= config.verticalSize) {
                        lineCount += 1;
                        lineCharCount = 0;
                    }
                    lineCharCount += 1;
                    break;
            }
        }
        return {lineCount: lineCount,lineCharCount: lineCharCount};
        
    }
    public dispose() {
        this._statusBarItem.dispose();
    }
}