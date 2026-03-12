import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { Globe, Mic } from "lucide-react";

export const Route = createFileRoute("/")({ component: Landing });

export default function Landing() {
	return (
		<div className="h-[100dvh] w-full flex flex-col items-center justify-center bg-gradient-to-br from-zinc-950 via-zinc-900 to-black relative overflow-hidden">
			{/* Background ambient gradients */}
			<div className="absolute inset-0 opacity-40 pointer-events-none overflow-hidden mix-blend-screen">
				<div className="absolute -top-40 -left-40 w-96 h-96 rounded-full blur-[120px] animate-blob bg-indigo-600/50"></div>
				<div className="absolute bottom-40 -right-40 w-96 h-96 rounded-full blur-[120px] animate-blob animation-delay-2000 bg-rose-600/40"></div>
			</div>

			{/* Content */}
			<div className="relative z-10 text-center max-w-2xl px-6">
				{/* Logo/Icon */}
				<div className="flex justify-center mb-8">
					<div className="w-24 h-24 rounded-full bg-gradient-to-br from-indigo-500 to-rose-500 flex items-center justify-center shadow-2xl">
						<Globe className="w-12 h-12 text-white" />
					</div>
				</div>

				{/* Heading */}
				<h1 className="font-display text-5xl md:text-7xl font-bold mb-6 text-white tracking-tight">
					Live Voice Translation
				</h1>

				{/* Subheading */}
				<p className="text-xl md:text-2xl text-zinc-300 mb-12 leading-relaxed font-light">
					Connect face-to-face with anyone, anywhere. Powered by real-time AI
					translation across 100+ languages.
				</p>

				{/* CTA Button */}
				<Link to="/translation">
					<button
						type="button"
						className="relative group inline-flex items-center justify-center gap-3 px-8 md:px-12 py-5 md:py-6 rounded-full bg-gradient-to-r from-indigo-500 to-rose-500 text-white font-semibold text-lg md:text-xl shadow-2xl hover:shadow-[0_0_60px_rgba(99,102,241,0.4)] transition-all duration-300 hover:scale-105 active:scale-95"
						data-testid="button-start-translation"
					>
						<Mic className="w-6 h-6" />
						Start Translation
						<span className="absolute inset-0 rounded-full bg-white/20 opacity-0 group-hover:opacity-100 transition-opacity duration-300 blur-xl"></span>
					</button>
				</Link>

				{/* Features Grid */}
				<div className="mt-20 grid grid-cols-1 md:grid-cols-3 gap-6">
					{[
						{
							title: "100+ Languages",
							desc: "Translate conversations in real-time",
						},
						{ title: "Crystal Clear", desc: "High-quality audio in & out" },
						{ title: "Device Control", desc: "Choose your mic & speaker" },
					].map((feature, i) => (
						<div
							key={i}
							className="bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl p-6 hover:bg-white/10 transition-colors"
						>
							<h3 className="font-semibold text-white mb-2">{feature.title}</h3>
							<p className="text-zinc-400 text-sm">{feature.desc}</p>
						</div>
					))}
				</div>

				{/* Powered by note */}
				<div className="mt-16 text-sm text-zinc-500">
					Powered by OpenAI &amp; Lingo.dev
				</div>
			</div>
		</div>
	);
}
