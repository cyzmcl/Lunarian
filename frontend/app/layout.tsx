import type { Metadata } from "next";
import { Inter, Roboto, Open_Sans } from "next/font/google";
import "./globals.css";
import { AppProvider } from "../context/AppContext"; // <-- Import your AppContext provider
import { Provider } from "../components/ui/provider";

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });
const roboto = Roboto({ weight: ['400', '700'], subsets: ['latin'], variable: '--font-roboto' });
const openSans = Open_Sans({ weight: ['400', '700'], subsets: ['latin'], variable: '--font-open-sans' });

export const metadata: Metadata = {
  title: "Lunarian - Smart Ad Generator",
  description: "Turn any photo into ad in seconds.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${inter.variable} ${roboto.variable} ${openSans.variable}`}>
        <AppProvider>
          <Provider>
            {children}
          </Provider>
        </AppProvider>
      </body>
    </html>
  );
}