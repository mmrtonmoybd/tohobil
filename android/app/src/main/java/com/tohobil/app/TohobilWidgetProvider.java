package com.tohobil.app;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.net.Uri;
import android.widget.RemoteViews;

public class TohobilWidgetProvider extends AppWidgetProvider {

    public static final String ACTION_UPDATE_WIDGET = "com.tohobil.app.ACTION_UPDATE_WIDGET";
    private static final String PREFS_NAME = "CapacitorStorage";
    private static final String PREF_BALANCE = "tohobil_widget_balance";
    private static final String PREF_CURRENCY = "tohobil_widget_currency";
    private static final String PREF_MASKED = "tohobil_widget_masked";

    @Override
    public void onUpdate(Context context, AppWidgetManager appWidgetManager, int[] appWidgetIds) {
        for (int appWidgetId : appWidgetIds) {
            updateAppWidget(context, appWidgetManager, appWidgetId);
        }
    }

    @Override
    public void onReceive(Context context, Intent intent) {
        super.onReceive(context, intent);
        if (ACTION_UPDATE_WIDGET.equals(intent.getAction())) {
            AppWidgetManager manager = AppWidgetManager.getInstance(context);
            ComponentName thisWidget = new ComponentName(context, TohobilWidgetProvider.class);
            int[] appWidgetIds = manager.getAppWidgetIds(thisWidget);
            onUpdate(context, manager, appWidgetIds);
        }
    }

    private static void updateAppWidget(Context context, AppWidgetManager appWidgetManager, int appWidgetId) {
        RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.tohobil_widget);

        // Load balance from SharedPreferences
        SharedPreferences prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
        String rawBalance = prefs.getString(PREF_BALANCE, "0");
        String currency = prefs.getString(PREF_CURRENCY, "BDT");
        String isMasked = prefs.getString(PREF_MASKED, "0");

        String displayBalance;
        String symbol = "BDT".equalsIgnoreCase(currency) ? "৳" : currency;
        if ("1".equals(isMasked)) {
            displayBalance = symbol + " ••••••";
        } else {
            try {
                long minor = Long.parseLong(rawBalance);
                double major = minor / 100.0;
                displayBalance = String.format("%s %,.2f", symbol, major);
            } catch (Exception e) {
                displayBalance = symbol + " 0.00";
            }
        }

        views.setTextViewText(R.id.widget_balance, displayBalance);

        // Intent to open Main App on card tap
        Intent homeIntent = new Intent(Intent.ACTION_VIEW, Uri.parse("tohobil://home"));
        homeIntent.setClass(context, MainActivity.class);
        homeIntent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        PendingIntent homePending = PendingIntent.getActivity(
                context,
                0,
                homeIntent,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );
        views.setOnClickPendingIntent(R.id.widget_container, homePending);

        // Intent to quick add expense
        Intent expenseIntent = new Intent(Intent.ACTION_VIEW, Uri.parse("tohobil://add?type=expense"));
        expenseIntent.setClass(context, MainActivity.class);
        expenseIntent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        PendingIntent expensePending = PendingIntent.getActivity(
                context,
                1,
                expenseIntent,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );
        views.setOnClickPendingIntent(R.id.widget_btn_expense, expensePending);

        // Intent to quick add income
        Intent incomeIntent = new Intent(Intent.ACTION_VIEW, Uri.parse("tohobil://add?type=income"));
        incomeIntent.setClass(context, MainActivity.class);
        incomeIntent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        PendingIntent incomePending = PendingIntent.getActivity(
                context,
                2,
                incomeIntent,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );
        views.setOnClickPendingIntent(R.id.widget_btn_income, incomePending);

        appWidgetManager.updateAppWidget(appWidgetId, views);
    }
}
