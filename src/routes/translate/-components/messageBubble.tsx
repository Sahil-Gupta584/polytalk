import langs from "langs";
import { getLangFlagUrl } from "../-actions";

export interface Message {
	id: string;
	lang: string;
	translatedText: string;
	timestamp: Date;
}

export function MessageBubble({ msg }: { msg: Message }) {
	const langName = langs.where("1", msg.lang)?.name || "English";
	
	return (
		<div className="flex flex-col gap-2 py-1">
			<div className="flex items-center gap-2">
				<img
					src={getLangFlagUrl(langName)}
					alt={`${langName} flag`}
					className="h-5 w-5 rounded-full object-cover"
				/>
				<span className="text-xs font-medium text-white/30 uppercase tracking-widest">
					{langName}
				</span>
				<div className="flex-1 h-px bg-white/[0.05]" />
				<span className="text-[10px] text-white/15">
					{msg.timestamp.toLocaleTimeString([], {
						hour: "2-digit",
						minute: "2-digit",
					})}
				</span>
			</div>

			<div className="flex items-start gap-2 mt-0.5 pl-7">
				<p className="text-white text-[15px] font-medium leading-relaxed">
					{msg.translatedText ? (
						msg.translatedText
					) : (
						<span className="inline-block w-20 h-4 bg-white/10 rounded-md animate-pulse align-middle" />
					)}
				</p>
			</div>
		</div>
	);
}
