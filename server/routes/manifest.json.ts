export default defineEventHandler((event) => {
  const config = useRuntimeConfig(event);
  const appName = config.public.appName as string;
  
  return {
    short_name: appName,
    version: "1.0.0",
    name: appName,
    description: "A social habit tracking app.",
    start_url: "/?source=pwa",
    scope: "/",
    display: "standalone",
    background_color: "#000000",
    theme_color: "#000000",
    icons: [
      {
        src: "/favicon-rounded.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "any"
      },
      {
        src: "/favicon-rounded.svg",
        sizes: "512x512",
        type: "image/svg+xml",
        purpose: "maskable"
      }
    ]
  };
});
